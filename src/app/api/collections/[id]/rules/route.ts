import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAddressFromHeader } from "@/lib/auth"

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const address = getAddressFromHeader(req)
    if (!address) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // First find the user by address
    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() }
    })

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const collection = await prisma.collection.findUnique({
      where: { 
        id: params.id,
        userId: user.id 
      },
      include: {
        traitRules: true,
      },
    })

    if (!collection) {
      return new NextResponse("Not found", { status: 404 })
    }

    // Fetch all traits referenced in rules
    const allTraitIds = collection.traitRules.flatMap(rule => rule.traitIds)
    const traits = await prisma.trait.findMany({
      where: {
        id: {
          in: allTraitIds
        }
      },
      include: {
        attribute: true
      }
    })

    // Map traits to rules
    const rulesWithTraits = collection.traitRules.map(rule => ({
      ...rule,
      traits: rule.traitIds.map(id => traits.find(t => t.id === id)).filter(Boolean)
    }))

    return NextResponse.json(rulesWithTraits)
  } catch (error) {
    console.error("[RULES_GET]", error)
    return new NextResponse("Internal error", { status: 500 })
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const address = getAddressFromHeader(req)
    if (!address) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // First find the user by address
    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() }
    })

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const collection = await prisma.collection.findUnique({
      where: { 
        id: params.id,
        userId: user.id 
      },
    })

    if (!collection) {
      return new NextResponse("Not found", { status: 404 })
    }

    const body = await req.json()
    const { ruleType, traitIds } = body

    // Create the rule with all traits, maintaining the order where the first trait
    // is the one being restricted
    const rule = await prisma.traitRule.create({
      data: {
        ruleType,
        traitIds,
        collectionId: params.id,
      },
    })

    // Fetch the traits for the response
    const traits = await prisma.trait.findMany({
      where: {
        id: {
          in: traitIds
        }
      },
      include: {
        attribute: true
      }
    })

    // Return the rule with traits
    const ruleWithTraits = {
      ...rule,
      traits: traitIds.map(id => traits.find(t => t.id === id)).filter(Boolean)
    }

    return NextResponse.json(ruleWithTraits)
  } catch (error) {
    console.error("[RULES_POST]", error)
    return new NextResponse("Internal error", { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const address = getAddressFromHeader(req)
    if (!address) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // First find the user by address
    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() }
    })

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    // Get the rule ID from the URL
    const url = new URL(req.url)
    const ruleId = url.searchParams.get("ruleId")
    
    if (!ruleId) {
      return new NextResponse("Rule ID is required", { status: 400 })
    }

    // First verify that the rule belongs to the collection and the collection belongs to the user
    const rule = await prisma.traitRule.findFirst({
      where: {
        id: ruleId,
        collection: {
          id: params.id,
          userId: user.id
        }
      }
    })

    if (!rule) {
      return new NextResponse("Rule not found", { status: 404 })
    }

    // Delete the rule
    await prisma.traitRule.delete({
      where: {
        id: ruleId
      }
    })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("[RULES_DELETE]", error)
    return new NextResponse("Internal error", { status: 500 })
  }
} 