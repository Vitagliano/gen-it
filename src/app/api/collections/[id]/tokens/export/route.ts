import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTokenTraits, generateTokenMetadata } from "@/lib/token-generator";
import { Attribute, Collection, Token, Trait } from "@prisma/client";
import JSZip from "jszip";
import sharp from "sharp";
import path from "path";

interface Dimensions {
  width: number;
  height: number;
}

type CollectionWithRelations = Omit<Collection, 'dimensions'> & {
  attributes: (Attribute & { 
    traits: Trait[];
    order: number;
  })[];
  dimensions: Dimensions;
  tokens: (Token & {
    traits: Trait[];
  })[];
  templates: {
    id: string;
    attributes: {
      attributeId: string;
      enabled: boolean;
    }[];
  }[];
};

type TokenWithTraits = Token & {
  traits: Trait[];
};

// Store export progress in memory (in a production app, this should be in Redis or similar)
const exportProgress = new Map<string, number>();
const exportData = new Map<string, Buffer>();

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { address } = await req.json();

    if (!address) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Start the export process in the background
    generateExport(params.id, address);

    return NextResponse.json({ message: "Export started" });
  } catch (error) {
    console.error("Error starting export:", error);
    return NextResponse.json(
      { error: "Failed to start export" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const download = searchParams.get("download") === "true";

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    // If download parameter is true, return the zip file
    if (download) {
      const zipBuffer = exportData.get(params.id);
      if (!zipBuffer) {
        return NextResponse.json(
          { error: "Export not found or still in progress" },
          { status: 404 }
        );
      }

      // Get collection name for the filename
      const collection = await prisma.collection.findFirst({
        where: {
          id: params.id,
          user: {
            address: address.toLowerCase(),
          },
        },
        select: { name: true },
      });

      if (!collection) {
        return NextResponse.json(
          { error: "Collection not found" },
          { status: 404 }
        );
      }

      // Clear the stored data after download
      exportData.delete(params.id);
      exportProgress.delete(params.id);

      return new NextResponse(zipBuffer, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${collection.name}-export.zip"`,
        },
      });
    }

    // Otherwise return the progress
    const progress = exportProgress.get(params.id) ?? 0;
    const isComplete = progress === 100 && exportData.has(params.id);

    return NextResponse.json({ progress, isComplete });
  } catch (error) {
    console.error("Error checking export status:", error);
    return NextResponse.json(
      { error: "Failed to check export status" },
      { status: 500 }
    );
  }
}

async function generateExport(collectionId: string, address: string) {
  try {
    // Set initial progress
    exportProgress.set(collectionId, 0);

    // Fetch collection data
    const collectionData = await prisma.collection.findFirst({
      where: {
        id: collectionId,
        user: {
          address: address.toLowerCase(),
        },
      },
      include: {
        attributes: {
          include: {
            traits: {
              where: {
                isEnabled: true,
              },
            },
          },
        },
        templates: {
          include: {
            attributes: true,
          },
        },
        tokens: {
          include: {
            traits: true,
          },
          orderBy: {
            tokenNumber: "asc",
          },
        },
      },
    });

    if (!collectionData || !collectionData.seed) {
      throw new Error("Collection not found or has no seed");
    }

    // Parse dimensions from JSON and create properly typed collection object
    let dimensions: Dimensions = { width: 512, height: 512 };
    
    if (
      typeof collectionData.dimensions === 'object' && 
      collectionData.dimensions !== null &&
      'width' in collectionData.dimensions &&
      'height' in collectionData.dimensions &&
      typeof collectionData.dimensions.width === 'number' &&
      typeof collectionData.dimensions.height === 'number'
    ) {
      dimensions = {
        width: collectionData.dimensions.width,
        height: collectionData.dimensions.height
      };
    }

    const collection: CollectionWithRelations = {
      ...collectionData,
      dimensions,
    };

    const zip = new JSZip();
    const imagesFolder = zip.folder("images");
    const metadataFolder = zip.folder("metadata");

    if (!imagesFolder || !metadataFolder) {
      throw new Error("Failed to create zip folders");
    }

    const totalTokens = collection.tokens.length;
    let processedTokens = 0;

    // Process each token
    for (const token of collection.tokens) {
      // Generate metadata JSON
      const metadata = {
        name: `${collection.name} #${token.tokenNumber}`,
        description: collection.description || "",
        image: `${token.tokenNumber}.png`,
        attributes: token.traits.map(trait => {
          const attribute = collection.attributes.find(attr =>
            attr.traits.some(t => t.id === trait.id)
          );
          return {
            trait_type: attribute?.name || "",
            value: trait.name,
          };
        }),
      };

      // Add metadata JSON file
      metadataFolder.file(
        `${token.tokenNumber}.json`,
        JSON.stringify(metadata, null, 2)
      );

      // Generate and add image file
      const imageBuffer = await generateTokenImage(token, collection);
      imagesFolder.file(`${token.tokenNumber}.png`, imageBuffer);

      // Update progress
      processedTokens++;
      const progress = Math.round((processedTokens / totalTokens) * 100);
      exportProgress.set(collectionId, progress);
    }

    // Generate final zip file
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: {
        level: 5,
      },
    });

    // Store the zip file in memory
    exportData.set(collectionId, zipBuffer);
    exportProgress.set(collectionId, 100);
  } catch (error) {
    console.error("Error generating export:", error);
    // Set progress to -1 to indicate error
    exportProgress.set(collectionId, -1);
  }
}

// Generate token image by compositing trait layers
async function generateTokenImage(
  token: TokenWithTraits,
  collection: CollectionWithRelations
): Promise<Buffer> {
  try {
    const width = collection.dimensions.width || 512;
    const height = collection.dimensions.height || 512;
    
    // Create a blank canvas with transparent background
    let composite = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    // Sort traits by attribute order to ensure correct layering
    const sortedTraits = [...token.traits].sort((a, b) => {
      const attrA = collection.attributes.find(attr => 
        attr.traits.some(t => t.id === a.id)
      );
      const attrB = collection.attributes.find(attr => 
        attr.traits.some(t => t.id === b.id)
      );
      return (attrA?.order || 0) - (attrB?.order || 0);
    });

    // Prepare all trait images first
    const traitBuffers = await Promise.all(
      sortedTraits.map(async (trait) => {
        try {
          return await sharp(path.join(process.cwd(), "public", trait.imagePath))
            .resize(width, height, {
              fit: collection.pixelated ? 'fill' : 'contain',
              position: 'center',
              background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .toBuffer();
        } catch (error) {
          console.error(`Error processing trait image: ${trait.imagePath}`, error);
          return null;
        }
      })
    );

    // Filter out any failed trait images
    const validTraitBuffers = traitBuffers.filter((buffer): buffer is Buffer => buffer !== null);

    // Composite all layers at once
    if (validTraitBuffers.length > 0) {
      composite = composite.composite(
        validTraitBuffers.map(buffer => ({
          input: buffer,
          top: 0,
          left: 0,
          blend: 'over' // Use 'over' blend mode to properly handle transparency
        }))
      );
    }

    // Generate final image
    return await composite.png().toBuffer();
  } catch (error) {
    console.error("Error generating token image:", error);
    // Return a fallback image in case of error
    return await sharp({
      create: {
        width: collection.dimensions.width || 512,
        height: collection.dimensions.height || 512,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 } // Red square to indicate error
      }
    })
    .png()
    .toBuffer();
  }
} 