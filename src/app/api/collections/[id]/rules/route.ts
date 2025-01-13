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
        traitRules: {
          include: {
            traits: true,
          },
        },
      },
    })

    if (!collection) {
      return new NextResponse("Not found", { status: 404 })
    }

    return NextResponse.json(collection.traitRules)
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

    const rule = await prisma.traitRule.create({
      data: {
        ruleType,
        collection: {
          connect: { id: params.id },
        },
        traits: {
          connect: traitIds.map((id: string) => ({ id })),
        },
      },
      include: {
        traits: true,
      },
    })

    return NextResponse.json(rule)
  } catch (error) {
    console.error("[RULES_POST]", error)
    return new NextResponse("Internal error", { status: 500 })
  }
} 