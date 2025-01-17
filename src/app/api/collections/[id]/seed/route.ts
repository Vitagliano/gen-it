import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

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

    // Generate and update new seed
    const seed = crypto.randomBytes(32).toString('hex');
    await prisma.collection.update({
      where: { id: collection.id },
      data: { seed },
    });

    return NextResponse.json({
      message: "Seed regenerated successfully",
      seed,
    });
  } catch (error) {
    console.error("Error regenerating seed:", error);
    return NextResponse.json(
      { error: "Failed to regenerate seed" },
      { status: 500 }
    );
  }
} 