import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function weightedRandom(traits: { id: string; rarity: number }[]) {
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
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    // Delete existing tokens if any
    await prisma.token.deleteMany({
      where: {
        collectionId: params.id,
      },
    });

    // Update attribute orders
    await Promise.all(
      attributes.map((attr: { id: string; order: number; isEnabled: boolean }) =>
        prisma.attribute.update({
          where: { id: attr.id },
          data: {
            order: attr.order,
          },
        })
      )
    );

    // Generate new tokens
    const tokens = [];
    const enabledAttributes = attributes.filter((attr: { isEnabled: boolean }) => attr.isEnabled);

    for (let i = 0; i < collection.tokenAmount; i++) {
      // For each token, select traits based on the enabled attributes
      const selectedTraits = enabledAttributes.map((attr: { id: string }) => {
        const attribute = collection.attributes.find(a => a.id === attr.id);
        if (!attribute || !attribute.traits.length) return null;
        
        return weightedRandom(attribute.traits);
      }).filter(Boolean);

      const token = await prisma.token.create({
        data: {
          tokenNumber: i,
          metadata: {}, // To be filled with trait metadata
          collection: {
            connect: {
              id: collection.id,
            },
          },
          traits: {
            connect: selectedTraits.map((id) => ({ id })),
          },
        },
        include: {
          traits: true,
        },
      });

      tokens.push(token);
    }

    return NextResponse.json({
      message: "Tokens generated successfully",
      count: tokens.length,
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