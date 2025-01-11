"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, GripVertical } from "lucide-react";

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

export default function PreviewPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  useEffect(() => {
    if (!isConnected || !address) {
      router.push("/");
    }
  }, [isConnected, address, router]);

  useEffect(() => {
    if (isConnected && address) {
      fetchAttributes();
    }
  }, [address, isConnected, params.id]);

  const fetchAttributes = async () => {
    try {
      const response = await fetch(`/api/collections/${params.id}/attributes?address=${address}`);
      if (!response.ok) throw new Error("Failed to fetch attributes");
      const data = await response.json();
      // Add isEnabled flag to each attribute and ensure order
      const attributesWithState = data
        .map((attr: Attribute, index: number) => ({
          ...attr,
          isEnabled: true,
          order: attr.order || index,
        }))
        .sort((a: Attribute, b: Attribute) => a.order - b.order);
      setAttributes(attributesWithState);
      setIsLoading(false);
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
    
    // Remove the dragged item
    items.splice(draggedItem, 1);
    // Insert it at the new position
    items.splice(index, 0, draggedItemContent);
    
    // Update the order property for each item
    const reorderedItems = items.map((item, idx) => ({
      ...item,
      order: idx,
    }));

    setAttributes(reorderedItems);
    setDraggedItem(index);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleGenerateTokens = async () => {
    try {
      const response = await fetch(`/api/collections/${params.id}/tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address,
          attributes: attributes.map(attr => ({
            id: attr.id,
            isEnabled: attr.isEnabled,
            order: attr.order,
          })),
        }),
      });

      if (!response.ok) throw new Error("Failed to generate tokens");

      toast({
        title: "Success",
        description: "Tokens generated successfully",
      });
      
      router.push(`/collections/${params.id}/tokens`);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to generate tokens",
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
            onClick={() => router.push(`/collections/${params.id}/upload`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Adjust Default Template</h1>
        </div>
        <Button onClick={handleGenerateTokens}>Create Collection</Button>
      </div>

      <p className="text-gray-600 mb-8 text-center">
        Templates are used to set the layer order for each of the attribute
        groups in your collection. You can add more templates later to
        generate different types of tokens.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold mb-4">Attributes</h2>
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
                    src={`/${attribute.traits[0].imagePath}`}
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