import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
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

    // First, check if there are any templates for this collection
    const templates = await prisma.template.findMany({
      where: {
        collection: {
          id: params.id,
          user: {
            address: address.toLowerCase(),
          },
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

    // If no templates exist, create a default template
    if (templates.length === 0) {
      // Get all attributes for this collection
      const attributes = await prisma.attribute.findMany({
        where: {
          collectionId: params.id,
        },
        orderBy: {
          order: 'asc',
        },
      });

      // Create default template with all attributes enabled
      const defaultTemplate = await prisma.template.create({
        data: {
          name: "Default Template",
          rarity: 100,
          collection: {
            connect: {
              id: params.id,
            },
          },
          attributes: {
            create: attributes.map(attr => ({
              enabled: true,
              attribute: {
                connect: {
                  id: attr.id,
                },
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

      return NextResponse.json([defaultTemplate]);
    }

    // Transform the response to match the expected format in the frontend
    const formattedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      rarity: template.rarity,
      attributes: template.attributes.map(ta => ({
        id: ta.attribute.id,
        enabled: ta.enabled,
      })),
    }));

    return NextResponse.json(formattedTemplates);
  } catch (error) {
    console.error("[TEMPLATES_GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
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

    // Create template
    const template = await prisma.template.create({
      data: {
        name,
        rarity,
        collection: {
          connect: {
            id: params.id,
          },
        },
        attributes: {
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
        attributes: {
          include: {
            attribute: true,
          },
        },
      },
    });

    // Format the response to match the expected structure
    const formattedTemplate = {
      id: template.id,
      name: template.name,
      rarity: template.rarity,
      attributes: template.attributes.map(ta => ({
        id: ta.attribute.id,
        enabled: ta.enabled,
      })),
    };

    return NextResponse.json(formattedTemplate);
  } catch (error) {
    console.error("[TEMPLATE_CREATE]", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
} 