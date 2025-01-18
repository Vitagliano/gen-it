import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadToS3 } from "@/lib/s3";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const attributes = await prisma.attribute.findMany({
      where: {
        collection: {
          id: params.id,
          user: {
            address: address.toLowerCase(),
          },
        },
      },
      include: {
        traits: {
          orderBy: {
            name: 'asc'
          }
        }
      },
      orderBy: {
        order: 'asc'
      }
    });

    return NextResponse.json(attributes);
  } catch (error) {
    console.error("[ATTRIBUTES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const order = parseInt(formData.get("order") as string);
    const address = formData.get("address") as string;
    const files = formData.getAll("files") as File[];

    if (!name || !files.length || !address) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify collection ownership
    const collection = await prisma.collection.findFirst({
      where: {
        id: params.id,
        user: {
          address: address.toLowerCase(),
        },
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found or unauthorized" },
        { status: 404 }
      );
    }

    // Create attribute
    const attribute = await prisma.attribute.create({
      data: {
        name,
        order,
        collection: {
          connect: {
            id: params.id,
          },
        },
      },
    });

    // Process and save trait files
    const traits = await Promise.all(
      files.map(async (file) => {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Clean filename and ensure it's safe
        const cleanFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '-');
        const s3Key = `collections/${params.id}/${name}/${cleanFilename}`;

        // Upload to S3
        await uploadToS3(buffer, s3Key);

        // Create trait with cleaned name
        const traitName = cleanFilename.replace(/\.[^/.]+$/, ""); // Remove file extension
        return prisma.trait.create({
          data: {
            name: traitName,
            imagePath: s3Key, // Store S3 key instead of local path
            rarity: 100 / files.length, // Default equal distribution
            attribute: {
              connect: {
                id: attribute.id,
              },
            },
          },
        });
      })
    );

    return NextResponse.json({
      attribute,
      traits,
      message: "Upload successful"
    });
  } catch (error) {
    console.error("Error creating attribute:", error);
    return NextResponse.json(
      { error: "Failed to create attribute" },
      { status: 500 }
    );
  }
} 