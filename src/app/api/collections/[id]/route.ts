import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const collection = await prisma.collection.findFirst({
      where: {
        id: params.id,
        user: {
          address: address.toLowerCase(),
        },
      },
      select: {
        id: true,
        name: true,
        tokenAmount: true,
        dimensions: true,
        format: true,
        pixelated: true,
        description: true,
        tokens: {
          take: 1,
          include: {
            traits: true,
          },
        },
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(collection);
  } catch (error) {
    console.error("[COLLECTION_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(
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

    const body = await request.json();
    const {
      name,
      tokenAmount,
      dimensions,
      format,
      pixelated,
      metadataFormat,
      tokenNamePattern,
      description,
    } = body;

    // Validate token amount
    if (tokenAmount !== undefined && (isNaN(tokenAmount) || tokenAmount < 1)) {
      return NextResponse.json(
        { error: "Invalid token amount" },
        { status: 400 }
      );
    }

    // Validate dimensions
    if (dimensions) {
      const maxSize = format === "GIF" ? 2000 : 2400;
      if (dimensions.width > maxSize || dimensions.height > maxSize) {
        return NextResponse.json(
          { error: `Maximum dimension size is ${maxSize}px` },
          { status: 400 }
        );
      }
    }

    // Validate format
    if (format && !["PNG", "JPG", "GIF", "SVG"].includes(format)) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }

    // Validate metadata format
    if (
      metadataFormat &&
      !["Ethereum", "Solana", "Other"].includes(metadataFormat)
    ) {
      return NextResponse.json(
        { error: "Invalid metadata format" },
        { status: 400 }
      );
    }

    // Validate token name pattern
    if (
      tokenNamePattern &&
      !tokenNamePattern.includes("{collection}") &&
      !tokenNamePattern.includes("{id}")
    ) {
      return NextResponse.json(
        { error: "Token name pattern must include {collection} and {id}" },
        { status: 400 }
      );
    }

    const collection = await prisma.collection.update({
      where: {
        id: params.id,
        user: {
          address: address.toLowerCase(),
        },
      },
      data: {
        ...(name && { name }),
        ...(tokenAmount && { tokenAmount }),
        ...(dimensions && { dimensions }),
        ...(format && { format }),
        ...(typeof pixelated === "boolean" && { pixelated }),
        ...(typeof description === "string" && { description }),
      },
      select: {
        id: true,
        name: true,
        tokenAmount: true,
        dimensions: true,
        format: true,
        pixelated: true,
        description: true,
        tokens: {
          take: 1,
          include: {
            traits: true,
          },
        },
      },
    });

    return NextResponse.json(collection);
  } catch (error) {
    console.error("[COLLECTION_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
