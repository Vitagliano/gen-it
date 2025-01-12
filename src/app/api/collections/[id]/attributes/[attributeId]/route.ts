import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; attributeId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
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

    const body = await request.json();
    const { order, isEnabled } = body;

    // Update attribute
    const attribute = await prisma.attribute.update({
      where: {
        id: params.attributeId,
        collectionId: params.id,
      },
      data: {
        ...(typeof order === 'number' && { order }),
        traits: {
          ...(typeof isEnabled === 'boolean' && {
            updateMany: {
              where: {},
              data: {
                isEnabled,
              },
            },
          }),
        },
      },
      include: {
        traits: {
          orderBy: {
            name: 'asc',
          },
        },
      },
    });

    return NextResponse.json(attribute);
  } catch (error) {
    console.error("[ATTRIBUTE_PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update attribute" },
      { status: 500 }
    );
  }
} 