import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

// Validate file type
function isValidFileType(filename: string): boolean {
  const validExtensions = ['.png', '.jpg', '.jpeg', '.svg'];
  const ext = path.extname(filename).toLowerCase();
  return validExtensions.includes(ext);
}

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
    const files = formData.getAll("files") as File[];
    const address = formData.get("address") as string;

    // Validate inputs
    if (!name || isNaN(order) || !files.length || !address) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate file types
    const invalidFiles = files.filter(file => !isValidFileType(file.name));
    if (invalidFiles.length > 0) {
      return NextResponse.json(
        { 
          error: "Invalid file types", 
          files: invalidFiles.map(f => f.name)
        },
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
        { error: "Collection not found" },
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

    // Create upload directory structure
    const uploadDir = path.join(process.cwd(), "public", "assets", params.id, name);
    await mkdir(uploadDir, { recursive: true });

    // Process and save trait files
    const traits = await Promise.all(
      files.map(async (file) => {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        
        // Clean filename and ensure it's safe
        const cleanFilename = path.basename(file.name).replace(/[^a-zA-Z0-9.-]/g, '-');
        const filePath = path.join("assets", params.id, name, cleanFilename);
        const fullPath = path.join(process.cwd(), "public", filePath);

        await writeFile(fullPath, buffer);

        // Create trait with cleaned name
        const traitName = path.parse(cleanFilename).name;
        return prisma.trait.create({
          data: {
            name: traitName,
            imagePath: filePath,
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