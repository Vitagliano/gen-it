import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type TokenCreateInput = Prisma.TokenCreateManyInput;

interface TokenTraitConnection {
  tokenNumber: number;
  traitIds: string[];
}

function weightedRandom<T extends { id: string; rarity: number }>(items: T[]) {
  const totalWeight = items.reduce((acc, item) => acc + item.rarity, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of items) {
    random -= item.rarity;
    if (random <= 0) {
      return item;
    }
  }
  
  return items[0];
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { address, attributes } = await req.json();

    if (!address || !attributes) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify collection ownership and fetch collection with templates
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
            attributes: {
              include: {
                attribute: true,
              },
            },
          },
        },
        tokens: {
          include: {
            traits: true,
          },
          orderBy: {
            tokenNumber: 'asc',
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

    // Delete existing tokens
    await prisma.token.deleteMany({
      where: {
        collectionId: params.id,
      },
    });

    // Generate new tokens in batch
    const tokensData: TokenCreateInput[] = [];
    const tokenTraitConnections: TokenTraitConnection[] = [];

    for (let i = 0; i < collection.tokenAmount; i++) {
      // Select a template based on rarity
      const selectedTemplate = weightedRandom(collection.templates);
      
      // For each token, select traits based on the template's enabled attributes
      const selectedTraits = attributes
        .filter((attr: { id: string; isEnabled: boolean }) => {
          const templateAttribute = selectedTemplate.attributes.find(
            ta => ta.attribute.id === attr.id
          );
          return attr.isEnabled && templateAttribute?.enabled;
        })
        .map((attr: { id: string }) => {
          const attribute = collection.attributes.find(a => a.id === attr.id);
          if (!attribute || !attribute.traits.length) return null;
          
          return weightedRandom(attribute.traits).id;
        })
        .filter(Boolean) as string[];

      tokensData.push({
        tokenNumber: i,
        metadata: {}, // To be filled with trait metadata
        collectionId: collection.id,
      });

      // Store trait connections for this token
      tokenTraitConnections.push({
        tokenNumber: i,
        traitIds: selectedTraits,
      });
    }

    // Split tokens into smaller batches to prevent transaction timeout
    const BATCH_SIZE = 100;
    let totalTokens = 0;

    for (let i = 0; i < tokensData.length; i += BATCH_SIZE) {
      const batchTokensData = tokensData.slice(i, i + BATCH_SIZE);
      const batchTraitConnections = tokenTraitConnections.slice(i, i + BATCH_SIZE);

      // Use transaction for each batch
      const batchResult = await prisma.$transaction(async (tx) => {
        // 1. Create tokens in this batch
        await tx.token.createMany({
          data: batchTokensData,
        });

        // 2. Fetch created tokens in this batch
        const createdTokens = await tx.token.findMany({
          where: {
            collectionId: collection.id,
            tokenNumber: {
              gte: i,
              lt: i + BATCH_SIZE,
            },
          },
          orderBy: {
            tokenNumber: 'asc',
          },
        });

        // 3. Connect traits to tokens in this batch
        await Promise.all(
          createdTokens.map((token, index) => {
            const connections = batchTraitConnections[index];
            return tx.token.update({
              where: { id: token.id },
              data: {
                traits: {
                  connect: connections.traitIds.map((traitId: string) => ({ id: traitId })),
                },
              },
            });
          })
        );

        return createdTokens.length;
      }, {
        timeout: 10000, // Increase timeout to 10 seconds per batch
      });

      totalTokens += batchResult;
    }

    return NextResponse.json({
      message: "Tokens generated successfully",
      count: totalTokens,
    });
  } catch (error) {
    console.error("Error generating tokens:", error);
    return NextResponse.json(
      { error: "Failed to generate tokens" },
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
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const tokens = await prisma.token.findMany({
      where: {
        collection: {
          id: params.id,
          user: {
            address: address.toLowerCase(),
          },
        },
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