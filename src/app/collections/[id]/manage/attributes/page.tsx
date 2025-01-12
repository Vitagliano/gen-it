"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Search } from "lucide-react";

interface Trait {
  id: string;
  name: string;
  imagePath: string;
  rarity: number;
  isEnabled: boolean;
}

interface Attribute {
  id: string;
  name: string;
  order: number;
  traits: Trait[];
}

interface Collection {
  id: string;
  name: string;
  pixelated: boolean;
}

export default function AttributesPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [editedAttributes, setEditedAttributes] = useState<Attribute[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      fetchCollection();
      fetchAttributes();
    }
  }, [address, isConnected, params.id]);

  useEffect(() => {
    if (attributes.length > 0) {
      setEditedAttributes(JSON.parse(JSON.stringify(attributes)));
    }
  }, [attributes]);

  useEffect(() => {
    if (attributes.length > 0 && editedAttributes.length > 0) {
      const hasChanges = JSON.stringify(attributes) !== JSON.stringify(editedAttributes);
      setHasChanges(hasChanges);
    }
  }, [attributes, editedAttributes]);

  const fetchCollection = async () => {
    try {
      const response = await fetch(
        `/api/collections/${params.id}?address=${address}`
      );
      if (!response.ok) throw new Error("Failed to fetch collection");
      const data = await response.json();
      setCollection(data);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch collection",
        variant: "destructive",
      });
    }
  };

  const fetchAttributes = async () => {
    try {
      const response = await fetch(
        `/api/collections/${params.id}/attributes?address=${address}`
      );
      if (!response.ok) throw new Error("Failed to fetch attributes");
      const data = await response.json();
      setAttributes(data);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch attributes",
        variant: "destructive",
      });
    }
  };

  const handleUpdateTraitRarity = (attributeId: string, traitId: string, newRarity: number) => {
    setEditedAttributes(prev => 
      prev.map(attr => 
        attr.id === attributeId
          ? {
              ...attr,
              traits: attr.traits.map(trait =>
                trait.id === traitId
                  ? { ...trait, rarity: newRarity }
                  : trait
              ),
            }
          : attr
      )
    );
  };

  const handleToggleTrait = (attributeId: string, traitId: string) => {
    setEditedAttributes(prev => 
      prev.map(attr => 
        attr.id === attributeId
          ? {
              ...attr,
              traits: attr.traits.map(trait =>
                trait.id === traitId
                  ? { ...trait, isEnabled: !trait.isEnabled }
                  : trait
              ),
            }
          : attr
      )
    );
  };

  const handleSaveChanges = async () => {
    try {
      // Find attributes with changed traits
      const changedAttributes = editedAttributes.filter(editedAttr => {
        const originalAttr = attributes.find(a => a.id === editedAttr.id);
        return JSON.stringify(originalAttr?.traits) !== JSON.stringify(editedAttr.traits);
      });

      // Update each changed attribute's traits
      for (const attribute of changedAttributes) {
        const response = await fetch(
          `/api/collections/${params.id}/attributes/${attribute.id}?address=${address}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              traits: attribute.traits,
            }),
          }
        );

        if (!response.ok) throw new Error(`Failed to update attribute ${attribute.name}`);
      }

      setAttributes(editedAttributes);
      setHasChanges(false);

      toast({
        title: "Success",
        description: "Changes saved successfully",
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    }
  };

  const handleDiscard = () => {
    setEditedAttributes(JSON.parse(JSON.stringify(attributes)));
    setHasChanges(false);
  };

  const filteredAttributes = editedAttributes.filter(attribute =>
    attribute.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    attribute.traits.some(trait =>
      trait.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  if (!isConnected || !address) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Attributes</h1>
          <p className="text-gray-600">
            Manage your collection's attributes and their traits.{" "}
            <a href="#" className="text-primary hover:underline">
              Learn more
            </a>
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by attribute or trait..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="space-y-8">
        {filteredAttributes.map((attribute) => (
          <div key={attribute.id} className="border rounded-lg p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-semibold">{attribute.name}</h2>
                <div className="text-sm text-gray-500">
                  {attribute.traits.length} traits
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {attribute.traits.map((trait) => (
                <div
                  key={trait.id}
                  className="border rounded-lg overflow-hidden"
                >
                  <div className="relative aspect-square bg-[#f5f5f5] bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee),linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]">
                    <img
                      src={`/${trait.imagePath}`}
                      alt={trait.name}
                      className={
                        collection?.pixelated
                          ? "object-contain w-full h-full image-rendering-pixelated"
                          : "object-contain w-full h-full"
                      }
                    />
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{trait.name}</span>
                      <Switch
                        checked={trait.isEnabled}
                        onCheckedChange={() =>
                          handleToggleTrait(attribute.id, trait.id)
                        }
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>Estimated {trait.rarity}%</span>
                        <div className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${trait.rarity <= 8.33 ? 'bg-primary' : 'bg-gray-300'}`} />
                          <span className={`w-2 h-2 rounded-full ${trait.rarity > 8.33 && trait.rarity <= 16.67 ? 'bg-primary' : 'bg-gray-300'}`} />
                          <span className={`w-2 h-2 rounded-full ${trait.rarity > 16.67 ? 'bg-primary' : 'bg-gray-300'}`} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="w-8 h-8"
                          onClick={() => handleUpdateTraitRarity(attribute.id, trait.id, Math.max(0, trait.rarity - 1))}
                        >
                          #
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="w-8 h-8"
                          onClick={() => handleUpdateTraitRarity(attribute.id, trait.id, Math.min(100, trait.rarity + 1))}
                        >
                          %
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            You have unsaved changes
          </p>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={handleDiscard}>
              Discard Changes
            </Button>
            <Button
              onClick={handleSaveChanges}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Save & Apply Settings
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
