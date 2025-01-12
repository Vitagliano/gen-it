import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; attributeId: string; traitId: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const address = searchParams.get("address")

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      )
    }

    // Verify collection ownership
    const collection = await prisma.collection.findFirst({
      where: {
        id: params.id,
        user: {
          address: address.toLowerCase(),
        },
      },
    })

    if (!collection) {
      return NextResponse.json(
        { error: "Collection not found" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { rarity, isEnabled } = body

    // Validate rarity if provided
    if (typeof rarity === 'number' && (rarity < 0 || rarity > 100)) {
      return NextResponse.json(
        { error: "Rarity must be between 0 and 100" },
        { status: 400 }
      )
    }

    // Update trait
    const trait = await prisma.trait.update({
      where: {
        id: params.traitId,
        attributeId: params.attributeId,
        attribute: {
          collectionId: params.id,
        },
      },
      data: {
        ...(typeof rarity === 'number' && { rarity }),
        ...(typeof isEnabled === 'boolean' && { isEnabled }),
      },
    })

    return NextResponse.json(trait)
  } catch (error) {
    console.error("[TRAIT_PATCH]", error)
    return NextResponse.json(
      { error: "Failed to update trait" },
      { status: 500 }
    )
  }
} 