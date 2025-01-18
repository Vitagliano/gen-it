import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
// import { generateTokenMetadata } from "@/lib/token-generator";

interface Trait {
  id: string;
  rarity: number;
}

interface Attribute {
  id: string;
  name: string;
  traits: Trait[];
}

function weightedRandom(traits: Trait[]) {
  const totalWeight = traits.reduce((acc, trait) => acc + trait.rarity, 0);
  let random = Math.random() * totalWeight;

  for (const trait of traits) {
    random -= trait.rarity;
    if (random <= 0) {
      return trait.id;
    }
  }

  return traits[0].id;
}

function getUniqueCombination(
  attributes: Attribute[],
  existingCombinations: Set<string>
): string[] | null {
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loops

  while (attempts < maxAttempts) {
    const selectedTraits = attributes.map((attribute) => {
      return weightedRandom(attribute.traits);
    });

    const combinationKey = selectedTraits.sort().join(",");
    if (!existingCombinations.has(combinationKey)) {
      existingCombinations.add(combinationKey);
      return selectedTraits;
    }

    attempts++;
  }

  return null; // No unique combination found
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { address, tokenAmount, attributes } = await req.json();

    if (!address || !tokenAmount || !attributes) {
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

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    // Calculate maximum possible combinations
    const maxCombinations = collection.attributes.reduce(
      (acc, attr) => acc * attr.traits.length,
      1
    );

    if (tokenAmount > maxCombinations) {
      return NextResponse.json(
        {
          error: `Cannot generate more than ${maxCombinations} unique combinations`,
        },
        { status: 400 }
      );
    }

    // If reducing token amount, delete excess tokens
    if (tokenAmount < collection.tokens.length) {
      await prisma.token.deleteMany({
        where: {
          collectionId: params.id,
          tokenNumber: {
            gte: tokenAmount,
          },
        },
      });
    }
    // If increasing token amount, generate new tokens while keeping existing ones
    else if (tokenAmount > collection.tokens.length) {
      const existingCombinations = new Set(
        collection.tokens.map((token) =>
          token.traits
            .map((trait) => trait.id)
            .sort()
            .join(",")
        )
      );

      const newTokensNeeded = tokenAmount - collection.tokens.length;
      // const startingTokenNumber = collection.tokens.length;

      for (let i = 0; i < newTokensNeeded; i++) {
        const selectedTraits = getUniqueCombination(
          collection.attributes,
          existingCombinations
        );

        if (!selectedTraits) {
          return NextResponse.json(
            { error: "Could not generate more unique combinations" },
            { status: 400 }
          );
        }

        // await prisma.token.create({
        //   data: {
        //     tokenNumber: startingTokenNumber + i,
        //     metadata: JSON.parse(JSON.stringify(generateTokenMetadata(collection, selectedTraits))),
        //     collection: {
        //       connect: {
        //         id: collection.id,
        //       },
        //     },
        //     traits: {
        //       connect: selectedTraits.map((id) => ({ id })),
        //     },
        //   },
        // });
      }
    }

    // Update collection token amount
    await prisma.collection.update({
      where: {
        id: params.id,
      },
      data: {
        tokenAmount,
      },
    });

    return NextResponse.json({
      message: "Token amount updated successfully",
    });
  } catch (error) {
    console.error("Error updating token amount:", error);
    return NextResponse.json(
      { error: "Failed to update token amount" },
      { status: 500 }
    );
  }
}
