import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTokenTraits, generateTokenMetadata } from "@/lib/token-generator";

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

    // Verify collection ownership and fetch collection with all necessary data
    const collection = await prisma.collection.findFirst({
      where: {
        id: params.id,
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
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    if (!collection.seed) {
      return NextResponse.json(
        { error: "Collection has no seed" },
        { status: 400 }
      );
    }

    // Delete existing tokens
    await prisma.token.deleteMany({
      where: {
        collectionId: params.id,
      },
    });

    // Generate and store new tokens in batch
    const BATCH_SIZE = 100;
    let totalTokens = 0;

    for (let i = 0; i < collection.tokenAmount; i += BATCH_SIZE) {
      const batchSize = Math.min(BATCH_SIZE, collection.tokenAmount - i);
      const batchTokens = Array.from({ length: batchSize }, (_, index) => {
        const tokenNumber = i + index;
        const tokenTraits = generateTokenTraits(collection, tokenNumber);
        
        if (!tokenTraits) {
          throw new Error("Failed to generate token traits");
        }

        return {
          tokenNumber,
          metadata: generateTokenMetadata(collection, tokenTraits.traitIds),
          collectionId: collection.id,
          traitIds: tokenTraits.traitIds,
        };
      });

      // Use transaction for each batch
      const batchResult = await prisma.$transaction(async (tx) => {
        // Create tokens in this batch
        const createdTokens = await Promise.all(
          batchTokens.map(async (token) => {
            return tx.token.create({
              data: {
                tokenNumber: token.tokenNumber,
                metadata: token.metadata,
                collection: {
                  connect: { id: token.collectionId },
                },
                traits: {
                  connect: token.traitIds.map((id) => ({ id })),
                },
              },
            });
          })
        );

        return createdTokens.length;
      });

      totalTokens += batchResult;
    }

    return NextResponse.json({
      message: "Tokens exported successfully",
      count: totalTokens,
    });
  } catch (error) {
    console.error("Error exporting tokens:", error);
    return NextResponse.json(
      { error: "Failed to export tokens" },
      { status: 500 }
    );
  }
} 