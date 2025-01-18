import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTokenTraits, generateTokenMetadata } from "@/lib/token-generator";
import crypto from "crypto";

// Helper function to generate preview tokens
// async function generatePreviewTokens(collection: any) {
//   const tokens = [];
//   for (let i = 0; i < collection.tokenAmount; i++) {
//     const tokenTraits = generateTokenTraits(collection, i);
//     if (!tokenTraits) continue;

//     const metadata = generateTokenMetadata(collection, tokenTraits.traitIds);
//     const traits = await prisma.trait.findMany({
//       where: {
//         id: {
//           in: tokenTraits.traitIds
//         }
//       }
//     });

//     tokens.push({
//       tokenNumber: i,
//       metadata,
//       traits
//     });
//   }
//   return tokens;
// }

// Export endpoint - persists tokens to database
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
        traitRules: true,
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    // Ensure collection has a seed
    if (!collection.seed) {
      const seed = crypto.randomBytes(32).toString('hex');
      await prisma.collection.update({
        where: { id: collection.id },
        data: { seed },
      });
      collection.seed = seed;
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

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get("address");
    const preview = searchParams.get("preview") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const tokenNumber = searchParams.get("tokenNumber");
    const skip = (page - 1) * pageSize;

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
        traitRules: true,
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    if (preview) {
      if (!collection.seed) {
        const seed = crypto.randomBytes(32).toString('hex');
        await prisma.collection.update({
          where: { id: collection.id },
          data: { seed },
        });
        collection.seed = seed;
      }

      // Handle specific token number search
      if (tokenNumber !== null) {
        const tokenNum = parseInt(tokenNumber);
        if (tokenNum >= 0 && tokenNum < collection.tokenAmount) {
          const tokenTraits = generateTokenTraits(collection, tokenNum);
          if (tokenTraits) {
            const metadata = generateTokenMetadata(collection, tokenTraits.traitIds);
            const traits = await prisma.trait.findMany({
              where: {
                id: {
                  in: tokenTraits.traitIds
                }
              }
            });

            return NextResponse.json({
              tokens: [{
                tokenNumber: tokenNum,
                metadata,
                traits
              }],
              total: 1,
              hasMore: false
            });
          }
        }
        // Return empty result if token number is invalid
        return NextResponse.json({
          tokens: [],
          total: 0,
          hasMore: false
        });
      }

      // Generate only the tokens for the current page
      const previewTokens = [];
      for (let i = skip; i < skip + pageSize && i < collection.tokenAmount; i++) {
        const tokenTraits = generateTokenTraits(collection, i);
        if (!tokenTraits) continue;

        const metadata = generateTokenMetadata(collection, tokenTraits.traitIds);
        const traits = await prisma.trait.findMany({
          where: {
            id: {
              in: tokenTraits.traitIds
            }
          }
        });

        previewTokens.push({
          tokenNumber: i,
          metadata,
          traits
        });
      }

      return NextResponse.json({
        tokens: previewTokens,
        total: collection.tokenAmount,
        hasMore: skip + pageSize < collection.tokenAmount
      });
    }

    // Otherwise, fetch persisted tokens from database
    const tokens = await prisma.token.findMany({
      where: {
        collectionId: params.id,
      },
      include: {
        traits: true,
      },
      orderBy: {
        tokenNumber: "asc",
      },
    });

    return NextResponse.json(tokens);
  } catch (error) {
    console.error("Error fetching tokens:", error);
    return NextResponse.json(
      { error: "Failed to fetch tokens" },
      { status: 500 }
    );
  }
} 