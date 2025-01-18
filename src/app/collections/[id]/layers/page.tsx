"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { GripVertical, ArrowLeft } from "lucide-react";
import { getTraitImageUrl } from "@/lib/utils";

interface Trait {
  id: string;
  name: string;
  imagePath: string;
  rarity: number;
}

interface Attribute {
  id: string;
  name: string;
  order: number;
  traits: Trait[];
  isEnabled?: boolean;
}

export default function LayersPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [traitImageUrls, setTraitImageUrls] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (isConnected && address) {
      fetchAttributes();
    }
  }, [address, isConnected, params.id]);

  useEffect(() => {
    const fetchImageUrls = async () => {
      const urls = await Promise.all(
        attributes.map(async (attribute) => {
          if (attribute.traits[0]) {
            const url = await getTraitImageUrl(attribute.traits[0].imagePath);
            return { [attribute.id]: url };
          }
          return {};
        })
      );
      setTraitImageUrls(Object.assign({}, ...urls));
    };

    fetchImageUrls();
  }, [attributes]);

  const fetchAttributes = async () => {
    try {
      const response = await fetch(`/api/collections/${params.id}/attributes?address=${address}`);
      if (!response.ok) throw new Error("Failed to fetch attributes");
      const data = await response.json();
      const attributesWithState = data
        .map((attr: Attribute, index: number) => ({
          ...attr,
          isEnabled: true,
          order: attr.order || index,
        }))
        .sort((a: Attribute, b: Attribute) => a.order - b.order);
      setAttributes(attributesWithState);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch attributes",
        variant: "destructive",
      });
    }
  };

  const toggleAttribute = (attributeId: string) => {
    setAttributes(prev =>
      prev.map(attr =>
        attr.id === attributeId
          ? { ...attr, isEnabled: !attr.isEnabled }
          : attr
      )
    );
  };

  const handleDragStart = (index: number) => {
    setDraggedItem(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem === null) return;

    const items = [...attributes];
    const draggedItemContent = items[draggedItem];
    
    items.splice(draggedItem, 1);
    items.splice(index, 0, draggedItemContent);
    
    const reorderedItems = items.map((item, idx) => ({
      ...item,
      order: idx,
    }));

    setAttributes(reorderedItems);
    setDraggedItem(index);
  };

  const handleDragEnd = async () => {
    if (draggedItem !== null) {
      try {
        // Update the order in the database for each attribute
        await Promise.all(
          attributes.map(async (attr) => {
            const response = await fetch(
              `/api/collections/${params.id}/attributes/${attr.id}?address=${address}`,
              {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  order: attr.order,
                }),
              }
            );
            if (!response.ok) throw new Error("Failed to update attribute order");
          })
        );
      } catch (error) {
        console.error("Error:", error);
        toast({
          title: "Error",
          description: "Failed to update layer order",
          variant: "destructive",
        });
      }
    }
    setDraggedItem(null);
  };

  const handleGenerateTokens = async () => {
    try {
      // Create default template
      const templateResponse = await fetch(`/api/collections/${params.id}/templates?address=${address}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Default Template",
          rarity: 100,
          attributes: attributes.map(attr => ({
            id: attr.id,
            enabled: attr.isEnabled,
          })),
        }),
      });

      if (!templateResponse.ok) {
        const error = await templateResponse.json();
        throw new Error(error.error || "Failed to create template");
      }

      toast({
        title: "Success",
        description: "Template created successfully",
      });
      
      router.push(`/collections/${params.id}/tokens`);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create template",
        variant: "destructive",
      });
    }
  };

  if (!isConnected || !address) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Adjust Layer Order</h1>
        </div>
        <Button onClick={handleGenerateTokens}>Create Collection</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">Layers</h2>
          {attributes.map((attribute, index) => (
            <div
              key={attribute.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`flex items-center justify-between p-4 border rounded cursor-move
                ${draggedItem === index ? 'opacity-50 bg-gray-50' : ''}`}
            >
              <div className="flex items-center gap-4">
                <GripVertical className="w-4 h-4 text-gray-400" />
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">::</span>
                  <span>{attribute.name}</span>
                </div>
              </div>
              <Switch
                checked={attribute.isEnabled}
                onCheckedChange={() => toggleAttribute(attribute.id)}
              />
            </div>
          ))}
        </div>

        <div className="relative aspect-square border rounded-lg overflow-hidden bg-[#f5f5f5]">
          {attributes
            .filter(attr => attr.isEnabled)
            .sort((a, b) => a.order - b.order)
            .map((attribute) => (
              attribute.traits[0] && (
                <div key={attribute.id} className="absolute inset-0">
                  <img
                    src={traitImageUrls[attribute.id]}
                    alt={attribute.name}
                    className="object-contain w-full h-full"
                  />
                </div>
              )
            ))}
        </div>
      </div>
    </div>
  );
} 