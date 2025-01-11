"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Search, ChevronDown, RefreshCw } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Trait {
  id: string;
  name: string;
  imagePath: string;
  attributeId: string;
}

interface Token {
  id: string;
  tokenNumber: number;
  traits: Trait[];
}

interface Attribute {
  id: string;
  name: string;
  order: number;
  traits: Trait[];
}

interface Collection {
  id: string;
  tokenAmount: number;
}

export default function TokensPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [tokens, setTokens] = useState<Token[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTraits, setSelectedTraits] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [newTokenAmount, setNewTokenAmount] = useState<number>(0);
  const [maxPossibleCombinations, setMaxPossibleCombinations] = useState<number>(0);

  useEffect(() => {
    if (isConnected && address) {
      fetchTokens();
      fetchAttributes();
      fetchCollection();
    }
  }, [address, isConnected, params.id]);

  useEffect(() => {
    // Calculate maximum possible combinations
    const combinations = attributes.reduce((acc, attr) => {
      return acc * attr.traits.length;
    }, 1);
    setMaxPossibleCombinations(combinations);
  }, [attributes]);

  const fetchCollection = async () => {
    try {
      const response = await fetch(
        `/api/collections/${params.id}?address=${address}`
      );
      if (!response.ok) throw new Error("Failed to fetch collection");
      const data = await response.json();
      setCollection(data);
      setNewTokenAmount(data.tokenAmount);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const fetchTokens = async () => {
    try {
      const response = await fetch(
        `/api/collections/${params.id}/tokens?address=${address}`
      );
      if (!response.ok) throw new Error("Failed to fetch tokens");
      const data = await response.json();
      setTokens(data);
      setIsLoading(false);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch tokens",
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

  const handleRegenerate = async () => {
    try {
      setIsRegenerating(true);
      const response = await fetch(`/api/collections/${params.id}/tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address,
          regenerateAll: true,
          attributes: attributes.map((attr) => ({
            id: attr.id,
            isEnabled: true,
            order: attr.order,
          })),
        }),
      });

      if (!response.ok) throw new Error("Failed to regenerate tokens");

      toast({
        title: "Success",
        description: "Tokens regenerated successfully",
      });

      await fetchTokens();
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to regenerate tokens",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleTokenAmountChange = async (value: number) => {
    if (value > maxPossibleCombinations) {
      toast({
        title: "Warning",
        description: `Maximum possible combinations is ${maxPossibleCombinations}`,
        variant: "destructive",
      });
      return;
    }

    try {
      setIsRegenerating(true);
      const response = await fetch(`/api/collections/${params.id}/tokens/amount`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address,
          tokenAmount: value,
          attributes: attributes.map((attr) => ({
            id: attr.id,
            isEnabled: true,
            order: attr.order,
          })),
        }),
      });

      if (!response.ok) throw new Error("Failed to update token amount");

      toast({
        title: "Success",
        description: "Token amount updated successfully",
      });

      await fetchTokens();
      await fetchCollection();
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to update token amount",
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const toggleTrait = (traitId: string) => {
    const newSelectedTraits = new Set(selectedTraits);
    if (newSelectedTraits.has(traitId)) {
      newSelectedTraits.delete(traitId);
    } else {
      newSelectedTraits.add(traitId);
    }
    setSelectedTraits(newSelectedTraits);
  };

  const getTraitTokenCount = (traitId: string) => {
    return tokens.filter((token) =>
      token.traits.some((trait) => trait.id === traitId)
    ).length;
  };

  const filteredTokens = tokens
    .filter((token) => {
      if (!searchQuery) return true;

      // Search by token number
      if (token.tokenNumber.toString().includes(searchQuery.toLowerCase())) {
        return true;
      }

      // Search by trait name or attribute name
      return token.traits.some((trait) => {
        const attribute = attributes.find(
          (attr) => attr.id === trait.attributeId
        );
        return (
          trait.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (attribute &&
            attribute.name.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      });
    })
    .filter((token) => {
      // Filter by selected traits
      if (selectedTraits.size > 0) {
        return token.traits.some((trait) => selectedTraits.has(trait.id));
      }
      return true;
    });

  if (!isConnected || !address) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push(`/collections/`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">Generated Tokens</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={newTokenAmount}
              min={1}
              max={maxPossibleCombinations}
              disabled={isRegenerating}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value > maxPossibleCombinations) {
                  toast({
                    title: "Warning",
                    description: `Maximum possible combinations is ${maxPossibleCombinations}`,
                    variant: "destructive",
                  });
                  return;
                }
                setNewTokenAmount(value);
                handleTokenAmountChange(value);
              }}
              className="w-24"
            />
            <span className="text-sm text-gray-500">
              / {maxPossibleCombinations}
            </span>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Regenerate All
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Regenerate Collection</DialogTitle>
                <DialogDescription>
                  This will regenerate all tokens with new random combinations. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={handleRegenerate} disabled={isRegenerating}>
                  {isRegenerating ? "Regenerating..." : "Regenerate All"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <div className="space-y-6">
          <Accordion type="multiple" className="space-y-2">
            {attributes.map((attribute) => (
              <AccordionItem
                key={attribute.id}
                value={attribute.id}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">::</span>
                      <span className="font-semibold">{attribute.name}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {attribute.traits.length} traits
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 py-2">
                    {attribute.traits.map((trait) => {
                      const tokenCount = getTraitTokenCount(trait.id);
                      const percentage = (
                        (tokenCount / tokens.length) *
                        100
                      ).toFixed(1);

                      return (
                        <div
                          key={trait.id}
                          className="flex items-center justify-between gap-2 group"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={trait.id}
                              checked={selectedTraits.has(trait.id)}
                              onCheckedChange={() => toggleTrait(trait.id)}
                            />
                            <label htmlFor={trait.id} className="text-sm">
                              {trait.name}
                            </label>
                          </div>
                          <span className="text-xs text-gray-500">
                            {tokenCount} ({percentage}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Tokens Grid */}
        <div className="md:col-span-3">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by token #, attribute or trait name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTokens.map((token) => (
              <div
                key={token.id}
                className="relative aspect-square border rounded-lg overflow-hidden bg-[#f5f5f5] group hover:border-primary transition-colors"
              >
                {token.traits
                  .sort((a, b) => {
                    const attrA = attributes.find(
                      (attr) => attr.id === a.attributeId
                    );
                    const attrB = attributes.find(
                      (attr) => attr.id === b.attributeId
                    );
                    return (attrA?.order || 0) - (attrB?.order || 0);
                  })
                  .map((trait) => (
                    <div key={trait.id} className="absolute inset-0">
                      <Image
                        src={`http://localhost:3000/${trait.imagePath}`}
                        alt={trait.name}
                        fill
                        className="object-contain"
                      />
                    </div>
                  ))}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  Token #{token.tokenNumber}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
