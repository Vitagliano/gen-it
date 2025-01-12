import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    // Verify collection ownership and check if template exists
    const template = await prisma.template.findFirst({
      where: {
        id: params.templateId,
        collection: {
          id: params.id,
          user: {
            address: address.toLowerCase(),
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Check if this is the last template
    const templateCount = await prisma.template.count({
      where: {
        collectionId: params.id,
      },
    });

    if (templateCount <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last template" },
        { status: 400 }
      );
    }

    // Delete the template
    await prisma.template.delete({
      where: {
        id: params.templateId,
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

    const body = await request.json();

    // Verify collection ownership and check if template exists
    const template = await prisma.template.findFirst({
      where: {
        id: params.templateId,
        collection: {
          id: params.id,
          user: {
            address: address.toLowerCase(),
          },
        },
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Update the template
    const updatedTemplate = await prisma.template.update({
      where: {
        id: params.templateId,
      },
      data: {
        name: body.name,
        rarity: body.rarity,
        attributes: {
          updateMany: body.attributes.map((attr: { id: string; enabled: boolean }) => ({
            where: {
              attributeId: attr.id,
            },
            data: {
              enabled: attr.enabled,
            },
          })),
        },
      },
      include: {
        attributes: {
          include: {
            attribute: true,
          },
        },
      },
    });

    // Format the response to match the expected structure
    const formattedTemplate = {
      id: updatedTemplate.id,
      name: updatedTemplate.name,
      rarity: updatedTemplate.rarity,
      attributes: updatedTemplate.attributes.map(ta => ({
        id: ta.attribute.id,
        enabled: ta.enabled,
      })),
    };

    return NextResponse.json(formattedTemplate);
  } catch (error) {
    console.error("[TEMPLATE_UPDATE]", error);
    return NextResponse.json(
      { error: "Failed to update template" },
      { status: 500 }
    );
  }
} 