import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTokenTraits, generateTokenMetadata } from "@/lib/token-generator";
import crypto from "crypto";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { address, tokenNumbers } = await req.json();
    console.log('Regenerating tokens:', tokenNumbers);

    if (!address || !tokenNumbers) {
      return NextResponse.json(
        { error: "Missing required fields" },
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
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      );
    }

    console.log('Collection seed:', collection.seed);
    
    // Generate a temporary seed just for these tokens
    const tempSeed = crypto.randomBytes(32).toString('hex');
    console.log('Temporary seed:', tempSeed);

    // Store original seed and update collection with temp seed
    // const originalSeed = collection.seed;
    collection.seed = tempSeed;

    // Regenerate each selected token
    await Promise.all(
      tokenNumbers.map(async (tokenNumber: number) => {
        const tokenTraits = generateTokenTraits(collection, tokenNumber);
        console.log(`Token ${tokenNumber} new traits:`, tokenTraits);
        
        if (!tokenTraits) {
          console.log(`Failed to generate traits for token ${tokenNumber}`);
          return;
        }

        await prisma.$transaction(async (tx) => {
          const token = await tx.token.findFirst({
            where: {
              collectionId: params.id,
              tokenNumber: tokenNumber,
            },
            include: { traits: true }
          });

          if (!token) {
            console.log(`Token ${tokenNumber} not found`);
            return;
          }

          console.log(`Token ${tokenNumber} current traits:`, token.traits);

          const updatedToken = await tx.token.update({
            where: { id: token.id },
            data: {
              metadata: generateTokenMetadata(collection, tokenTraits.traitIds),
              traits: {
                set: [],
                connect: tokenTraits.traitIds.map(id => ({ id })),
              },
            },
            include: { traits: true }
          });

          console.log(`Token ${tokenNumber} updated traits:`, updatedToken.traits);
        });
      })
    );

    return NextResponse.json({
      message: "Tokens regenerated successfully",
    });
  } catch (error) {
    console.error("Error regenerating tokens:", error);
    return NextResponse.json(
      { error: "Failed to regenerate tokens" },
      { status: 500 }
    );
  }
} 