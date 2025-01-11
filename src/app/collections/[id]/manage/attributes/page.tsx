"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { Search, MoreHorizontal, Upload, Plus } from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";

interface Trait {
  id: string;
  name: string;
  rarity: number;
  imagePath: string;
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
  pixelated: boolean;
}

export default function AttributesPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("trait-az");
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!isConnected || !address) return;

      try {
        const [attributesResponse, collectionResponse] = await Promise.all([
          fetch(`/api/collections/${params.id}/attributes?address=${address}`),
          fetch(`/api/collections/${params.id}?address=${address}`)
        ]);

        if (!attributesResponse.ok || !collectionResponse.ok) {
          throw new Error("Failed to fetch data");
        }

        const attributesData = await attributesResponse.json();
        const collectionData = await collectionResponse.json();

        setAttributes(attributesData);
        setCollection(collectionData);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [params.id, address, isConnected]);

  const handleRarityChange = async (
    attributeId: string,
    traitId: string,
    newRarity: number
  ) => {
    if (!address) return;

    try {
      const response = await fetch(
        `/api/collections/${params.id}/attributes/${attributeId}/traits/${traitId}?address=${address}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ rarity: newRarity }),
        }
      );

      if (!response.ok) throw new Error("Failed to update trait rarity");

      setAttributes((prev) =>
        prev.map((attr) =>
          attr.id === attributeId
            ? {
                ...attr,
                traits: attr.traits.map((trait) =>
                  trait.id === traitId ? { ...trait, rarity: newRarity } : trait
                ),
              }
            : attr
        )
      );
    } catch (error) {
      console.error("Failed to update trait rarity:", error);
    }
  };

  const filteredAttributes = attributes
    .map((attr) => ({
      ...attr,
      traits: attr.traits.filter(
        (trait) =>
          trait.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          attr.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((attr) => attr.traits.length > 0);

  const sortTraits = (traits: Trait[]) => {
    switch (sortBy) {
      case "trait-az":
        return [...traits].sort((a, b) => a.name.localeCompare(b.name));
      case "trait-za":
        return [...traits].sort((a, b) => b.name.localeCompare(a.name));
      case "rarity-up":
        return [...traits].sort((a, b) => a.rarity - b.rarity);
      case "rarity-down":
        return [...traits].sort((a, b) => b.rarity - a.rarity);
      default:
        return traits;
    }
  };

  if (!isConnected || !address) {
    return null;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Attributes</h1>
        <p className="text-muted-foreground">
          Organise and edit your attributes and traits.{" "}
          <span className="text-primary hover:underline cursor-pointer">
            Learn more
          </span>
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by attribute or trait..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="trait-az">Trait (A-Z)</SelectItem>
            <SelectItem value="trait-za">Trait (Z-A)</SelectItem>
            <SelectItem value="rarity-up">Rarity (Low to High)</SelectItem>
            <SelectItem value="rarity-down">Rarity (High to Low)</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload
        </Button>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      <div className="space-y-8">
        {filteredAttributes.map((attribute) => (
          <div key={attribute.id} className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{attribute.name}</h2>
              <span className="text-sm text-muted-foreground">
                {attribute.traits.length} traits
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                  <DropdownMenuItem>Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="relative">
              <div className="flex overflow-x-auto pb-4 gap-4 snap-x">
                {sortTraits(attribute.traits).map((trait) => (
                  <div
                    key={trait.id}
                    className="flex-none w-[260px] border rounded-lg overflow-hidden bg-checkerboard snap-start"
                  >
                    <div className="relative aspect-square">
                      <img
                        src={`http://localhost:3000/${trait.imagePath}`}
                        alt={trait.name}
                        className={
                          collection?.pixelated
                            ? "object-contain w-full h-full image-rendering-pixelated"
                            : "object-contain w-full h-full"
                        }
                      />
                    </div>
                    <div className="p-4 bg-background">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">{trait.name}</div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[trait.rarity]}
                          onValueChange={([value]) =>
                            handleRarityChange(attribute.id, trait.id, value)
                          }
                          max={100}
                          step={0.1}
                          className="flex-1"
                        />
                        <div className="flex items-center gap-1 min-w-[80px]">
                          <span className="text-sm">Estimated</span>
                          <span className="text-sm font-medium">
                            {trait.rarity.toFixed(1)}%
                          </span>
                        </div>
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
