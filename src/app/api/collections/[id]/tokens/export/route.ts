import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Attribute, Collection, Trait, TraitRule } from "@prisma/client";
import JSZip from "jszip";
import sharp from "sharp";
import { getS3Url } from "@/lib/s3";
import { generateTokenTraits, generateTokenMetadata } from "@/lib/token-generator";

interface Dimensions {
  width: number;
  height: number;
}

type CollectionWithRelations = Omit<Collection, 'dimensions'> & {
  attributes: (Attribute & {
    traits: Trait[];
  })[];
  dimensions: Dimensions;
  templates: {
    id: string;
    attributes: {
      attributeId: string;
      enabled: boolean;
    }[];
  }[];
  traitRules: TraitRule[];
};

type TokenWithTraits = {
  tokenNumber: number;
  metadata: object;
  traits: Trait[];
};

// Store export progress and data in memory (consider using a persistent store like Redis for production)
const exportProgress = new Map<string, number>();
const exportData = new Map<string, { buffer: Buffer; name: string }>();

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

    if (!address) {
      return NextResponse.json(
        { error: "Missing address parameter" },
        { status: 400 }
      );
    }

    const progress = exportProgress.get(params.id);
    if (progress === undefined) {
      return NextResponse.json(
        { error: "No export found for this collection" },
        { status: 404 }
      );
    }

    if (progress < 100) {
      return NextResponse.json({
        progress,
        isComplete: false,
        message: `Export in progress: ${progress}% completed`
      });
    }

    const exportDataObj = exportData.get(params.id);
    if (!exportDataObj) {
      return NextResponse.json({
        error: "Export data not found"
      }, { status: 500 });
    }

    // Only send ZIP if explicitly requested via Accept header
    const acceptHeader = req.headers.get('Accept');
    if (acceptHeader === 'application/zip') {
      return new NextResponse(exportDataObj.buffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename=${exportDataObj.name}.zip`,
        },
      });
    }

    // Otherwise send progress status
    return NextResponse.json({
      progress: 100,
      isComplete: true,
      message: "Export complete"
    });
  } catch (error) {
    console.error("Error retrieving export:", error);
    return NextResponse.json(
      { error: "Failed to retrieve export" },
      { status: 500 }
    );
  }
}

async function generateExport(collectionId: string, address: string) {
  try {
    console.log(`Starting export for collection ${collectionId} by ${address}`);
    exportProgress.set(collectionId, 0);

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
          orderBy: {
            order: 'asc',
          },
        },
        templates: {
          include: {
            attributes: true,
          },
        },
        traitRules: true,
      },
    });

    if (!collectionData) {
      console.error(`Collection ${collectionId} not found for address ${address}`);
      throw new Error("Collection not found");
    }

    console.log(`Found collection with ${collectionData.tokenAmount} tokens`);

    // Parse dimensions
    const collection: CollectionWithRelations = {
      ...collectionData,
      dimensions: {
        width: Number((collectionData.dimensions as Record<string, number>)?.width) || 512,
        height: Number((collectionData.dimensions as Record<string, number>)?.height) || 512,
      }
    };
    console.log('Collection dimensions:', collection.dimensions);

    const zip = new JSZip();
    const imagesFolder = zip.folder("images");
    const metadataFolder = zip.folder("metadata");

    if (!imagesFolder || !metadataFolder) {
      console.error("Failed to create ZIP folders");
      throw new Error("Failed to create zip folders");
    }

    console.log('Created ZIP folders for images and metadata');

    const totalTokens = collectionData.tokenAmount;
    let processedTokens = 0;

    // Process tokens in smaller batches
    const batchSize = 5;
    console.log(`Processing ${totalTokens} tokens in batches of ${batchSize}`);

    for (let i = 0; i < totalTokens; i += batchSize) {
      const batch = Array.from({ length: Math.min(batchSize, totalTokens - i) }, (_, index) => i + index);

      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}, tokens ${i} to ${i + batch.length - 1}`);

      await Promise.all(batch.map(async (tokenNumber) => {
        try {
          console.log(`Processing token #${tokenNumber}`);

          // Generate traits and metadata
          const tokenTraits = generateTokenTraits(collectionData, tokenNumber);
          if (!tokenTraits) {
            console.error(`Failed to generate traits for token #${tokenNumber}`);
            return;
          }

          const metadata = generateTokenMetadata(collectionData, tokenTraits.traitIds) as any;

          // Fetch trait details
          const traits = collectionData.attributes.flatMap(attr => attr.traits).filter(trait => tokenTraits.traitIds.includes(trait.id));

          const token: TokenWithTraits = {
            tokenNumber,
            metadata,
            traits,
          };

          console.log(`Generated metadata for token #${token.tokenNumber}:`, metadata);

          // Add metadata JSON file
          metadataFolder.file(
            `${token.tokenNumber}.json`,
            JSON.stringify(metadata, null, 2)
          );

          // Generate and add image file
          console.log(`Generating image for token #${token.tokenNumber}`);
          const imageBuffer = await generateTokenImage(token, collection);
          console.log(`Generated image buffer for token #${token.tokenNumber}, size: ${imageBuffer.length} bytes`);

          imagesFolder.file(`${token.tokenNumber}.png`, imageBuffer);

          processedTokens++;
          const progress = Math.round((processedTokens / totalTokens) * 100);
          exportProgress.set(collectionId, progress);
          console.log(`Token #${token.tokenNumber} complete. Overall progress: ${progress}%`);
        } catch (error) {
          console.error(`Error processing token ${tokenNumber}:`, error);
          throw error;
        }
      }));
    }

    console.log('All tokens processed, generating final ZIP file');
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: {
        level: 5,
      }
    });
    console.log(`Generated ZIP file, size: ${zipBuffer.length} bytes`);

    exportData.set(collectionId, { buffer: zipBuffer, name: collectionData.name });
    exportProgress.set(collectionId, 100);
    console.log('Export complete');

    // After adding files to metadataFolder and imagesFolder
    console.log(`Added ${metadataFolder.files.size} metadata files and ${imagesFolder.files.size} image files to ZIP`);
  } catch (error) {
    console.error("Error generating export:", error);
    exportProgress.set(collectionId, -1);
    throw error;
  }
}

// Generate token image by compositing trait layers
async function generateTokenImage(
  token: TokenWithTraits,
  collection: CollectionWithRelations
): Promise<Buffer> {
  try {
    console.log(`Generating image for token #${token.tokenNumber}`);
    console.log('Traits to process:', token.traits.map(t => t.name));

    const width = collection.dimensions.width;
    const height = collection.dimensions.height;
    
    // Create base canvas
    const composite = sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    });

    const sortedTraits = [...token.traits].sort((a, b) => {
      const attrA = collection.attributes.find(attr =>
        attr.traits.some(t => t.id === a.id)
      );
      const attrB = collection.attributes.find(attr =>
        attr.traits.some(t => t.id === b.id)
      );
      return (attrA?.order || 0) - (attrB?.order || 0);
    });

    // Process trait images sequentially
    let compositeBuffer = await composite.png().toBuffer();

    for (const trait of sortedTraits) {
      try {
        const imageUrl = await getS3Url(trait.imagePath);
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Failed to fetch image: ${imageUrl}`);
        
        const buffer = await response.arrayBuffer();
        
        // Create a new Sharp instance for the trait image
        const traitImage = sharp(Buffer.from(buffer));
        const resizedBuffer = await traitImage
          .resize(width, height, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .png()
          .toBuffer();

        // Create a new Sharp instance for compositing
        compositeBuffer = await sharp(compositeBuffer)
          .composite([{
            input: resizedBuffer,
            top: 0,
            left: 0,
            blend: 'over'
          }])
          .png()
          .toBuffer();

      } catch (error) {
        console.error(`Error processing trait ${trait.name}:`, error);
        throw error; // Re-throw to handle the error in the batch processing
      }
    }

    return compositeBuffer;
  } catch (error) {
    console.error(`Error generating image for token #${token.tokenNumber}:`, error);
    throw error;
  }
} 