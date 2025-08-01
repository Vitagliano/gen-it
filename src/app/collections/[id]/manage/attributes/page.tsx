"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Search } from "lucide-react";

import debounce from "lodash/debounce";
import { getTraitImageUrl } from "@/lib/utils";

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
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [editedAttributes, setEditedAttributes] = useState<Attribute[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  // const [rarityMode, setRarityMode] = useState<"percentage" | "weight">(
  //   "percentage"
  // );
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [traitUrls, setTraitUrls] = useState<Record<string, string>>({});

  const rarityMode = "percentage";

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
    editedAttributes.forEach(attribute => {
      attribute.traits.forEach(async trait => {
        if (!traitUrls[trait.imagePath]) {
          const url = await getTraitImageUrl(trait.imagePath);
          setTraitUrls(prev => ({ ...prev, [trait.imagePath]: url }));
        }
      });
    });
  }, [editedAttributes]);

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

  const updateTraitRarities = (
    attributeId: string,
    traitId: string,
    newRarity: number
  ) => {
    setEditedAttributes((prev) =>
      prev.map((attr) => {
        if (attr.id !== attributeId) return attr;

        if (rarityMode === "percentage") {
          // Get all enabled traits except the current one
          const otherEnabledTraits = attr.traits.filter(
            (t) => t.id !== traitId && t.isEnabled
          );

          if (otherEnabledTraits.length === 0) {
            // If this is the only enabled trait, it should have 100% rarity
            return {
              ...attr,
              traits: attr.traits.map((trait) =>
                trait.id === traitId ? { ...trait, rarity: 100 } : trait
              ),
            };
          }

          // Calculate remaining rarity to distribute
          const remainingRarity = Math.max(0, 100 - newRarity);

          // Calculate current total of other traits
          const currentTotal = otherEnabledTraits.reduce(
            (sum, t) => sum + t.rarity,
            0
          );

          // If current total is 0, distribute remaining rarity equally
          const shouldDistributeEqually = currentTotal === 0;

          return {
            ...attr,
            traits: attr.traits.map((trait) => {
              if (trait.id === traitId) {
                return { ...trait, rarity: newRarity };
              }
              if (!trait.isEnabled) {
                return trait;
              }
              if (shouldDistributeEqually) {
                return {
                  ...trait,
                  rarity: remainingRarity / otherEnabledTraits.length,
                };
              }
              // Adjust proportionally based on current ratios
              const proportion = trait.rarity / currentTotal;
              return {
                ...trait,
                rarity: remainingRarity * proportion,
              };
            }),
          };
        } else {
          // For weight mode, just update the single trait
          return {
            ...attr,
            traits: attr.traits.map((trait) =>
              trait.id === traitId ? { ...trait, rarity: newRarity } : trait
            ),
          };
        }
      })
    );
  };

  const regenerateTokens = async () => {
    if (isRegenerating) return;

    setIsRegenerating(true);
    try {
      const response = await fetch(
        `/api/collections/${params.id}/tokens?address=${address}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address,
            attributes: editedAttributes.map((attr) => ({
              id: attr.id,
              order: attr.order,
              isEnabled: attr.traits.some((t) => t.isEnabled),
            })),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to regenerate tokens");
      }

      toast({
        title: "Success",
        description: "Tokens regenerated successfully",
      });
    } catch (error) {
      console.error("Error regenerating tokens:", error);
      toast({
        title: "Error",
        description: "Failed to regenerate tokens",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  // Debounced function to update trait rarity
  const debouncedUpdateTrait = useCallback(
    debounce(
      async (attributeId: string, traitId: string, newRarity: number) => {
        try {
          await fetch(
            `/api/collections/${params.id}/attributes/${attributeId}/traits/${traitId}?address=${address}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                rarity: newRarity,
              }),
            }
          );
        } catch (error) {
          console.error("Error updating trait rarity:", error);
          toast({
            title: "Error",
            description: "Failed to update trait rarity",
            variant: "destructive",
          });
        }
      },
      500
    ),
    [params.id, address]
  );

  const handleUpdateTraitRarity = (
    attributeId: string,
    traitId: string,
    newValue: number
  ) => {
    const newRarity = Math.min(100, Math.max(0, newValue));
    updateTraitRarities(attributeId, traitId, newRarity);
    debouncedUpdateTrait(attributeId, traitId, newRarity);
  };

  // const handleToggleTrait = (attributeId: string, traitId: string) => {
  //   setEditedAttributes((prev) =>
  //     prev.map((attr) => {
  //       if (attr.id !== attributeId) return attr;

  //       const updatedTraits = attr.traits.map((trait) =>
  //         trait.id === traitId
  //           ? { ...trait, isEnabled: !trait.isEnabled }
  //           : trait
  //       );

  //       // Recalculate rarities for enabled traits
  //       const enabledTraits = updatedTraits.filter((t) => t.isEnabled);
  //       const equalRarity = 100 / enabledTraits.length;

  //       return {
  //         ...attr,
  //         traits: updatedTraits.map((trait) =>
  //           trait.isEnabled ? { ...trait, rarity: equalRarity } : trait
  //         ),
  //       };
  //     })
  //   );
  // };

  const filteredAttributes = editedAttributes.filter(
    (attribute) =>
      attribute.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attribute.traits.some((trait) =>
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
            Manage your collection&lsquo;s attributes and their traits.{" "}
            <a href="#" className="text-primary hover:underline">
              Learn more
            </a>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* <Button
            variant="outline"
            onClick={() =>
              setRarityMode((prev) =>
                prev === "percentage" ? "weight" : "percentage"
              )
            }
          >
            {rarityMode === "percentage" ? "Switch to Weight" : "Switch to Percentage"}
          </Button> */}
          <Button onClick={regenerateTokens} disabled={isRegenerating}>
            {isRegenerating ? "Regenerating..." : "Regenerate Tokens"}
          </Button>
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

            <div className="overflow-x-auto">
              <div className="flex gap-4 min-w-max pb-4">
                {attribute.traits.map((trait) => (
                  <div key={trait.id} className="border rounded-lg w-[200px]">
                    <div className="relative aspect-square bg-[#f5f5f5] bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee),linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]">
                      <img
                        src={traitUrls[trait.imagePath] || ''}
                        alt={trait.name}
                        className={
                          collection?.pixelated
                            ? "object-contain w-full h-full image-rendering-pixelated"
                            : "object-contain w-full h-full"
                        }
                      />
                      <div className="absolute top-2 right-2">
                        {/* <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 bg-white/80 hover:bg-white"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem>
                              <div className="flex items-center justify-between w-full">
                                <span>Enabled</span>
                                <Switch
                                  checked={trait.isEnabled}
                                  onCheckedChange={() =>
                                    handleToggleTrait(attribute.id, trait.id)
                                  }
                                />
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              Show in metadata
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu> */}
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-medium text-sm">
                          {trait.name}
                        </span>
                      </div>

                      <div className="space-y-4">
                        {rarityMode === "percentage" ? (
                          <>
                            <Slider
                              value={[trait.rarity]}
                              onValueChange={([value]) =>
                                handleUpdateTraitRarity(
                                  attribute.id,
                                  trait.id,
                                  value
                                )
                              }
                              min={0}
                              max={100}
                              step={0.1}
                              disabled={!trait.isEnabled}
                            />
                            <div className="text-sm text-gray-500">
                              {trait.rarity.toFixed(1)}%
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={trait.rarity}
                              onChange={(e) =>
                                handleUpdateTraitRarity(
                                  attribute.id,
                                  trait.id,
                                  parseFloat(e.target.value)
                                )
                              }
                              min={0}
                              step={1}
                              disabled={!trait.isEnabled}
                              className="w-20"
                            />
                            <span className="text-sm text-gray-500">
                              weight
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
