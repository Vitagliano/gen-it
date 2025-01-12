import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; templateId: string } }
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

    const { name, rarity, attributes } = await request.json();

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

    // Update template
    const template = await prisma.template.update({
      where: {
        id: params.templateId,
        collectionId: params.id,
      },
      data: {
        name,
        rarity,
        attributes: {
          deleteMany: {},
          create: attributes.map((attr: { id: string; enabled: boolean }) => ({
            enabled: attr.enabled,
            attribute: {
              connect: {
                id: attr.id,
              },
            },
          })),
        },
      },
      include: {
        attributes: true,
      },
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("[TEMPLATE_UPDATE]", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; templateId: string } }
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

    // Delete template
    await prisma.template.delete({
      where: {
        id: params.templateId,
        collectionId: params.id,
      },
    });

    return NextResponse.json({
      message: "Template deleted successfully",
    });
  } catch (error) {
    console.error("[TEMPLATE_DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
} 