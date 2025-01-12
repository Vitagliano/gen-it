import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { name, description, tokenAmount, dimensions, format, address } = await req.json();

    // Validate required fields
    if (!name || !tokenAmount || !dimensions || !format || !address) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Find or create user with the provided address
    const user = await prisma.user.upsert({
      where: {
        address: address.toLowerCase(),
      },
      update: {},
      create: {
        address: address.toLowerCase(),
      },
    });

    // Create collection
    const collection = await prisma.collection.create({
      data: {
        name,
        description,
        tokenAmount,
        dimensions,
        format,
        user: {
          connect: {
            id: user.id,
          },
        },
      },
    });

    return NextResponse.json(collection);
  } catch (error) {
    console.error("Error creating collection:", error);
    return NextResponse.json(
      { error: "Failed to create collection" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const collections = await prisma.collection.findMany({
      where: {
        user: {
          address: address.toLowerCase(),
        },
      },
      include: {
        _count: {
          select: {
            tokens: true,
          },
        },
      },
    });

    return NextResponse.json(collections);
  } catch (error) {
    console.error("Error fetching collections:", error);
    return NextResponse.json(
      { error: "Failed to fetch collections" },
      { status: 500 }
    );
  }
} 