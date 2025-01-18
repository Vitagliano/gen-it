"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, RefreshCw } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

interface Trait {
  id: string;
  name: string;
  imagePath: string;
  attributeId: string;
}

interface Token {
  tokenNumber: number;
  metadata: {
    name: string;
    description: string;
    attributes: Array<{
      trait_type: string;
      value: string;
    }>;
  };
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
  name: string;
  tokenAmount: number;
  pixelated: boolean;
  description?: string;
  tokenNamePattern: string;
}

const SelectionBar = ({
  selectedCount,
  onClear,
  onRegenerateSelected,
  onSelectAll,
  isAllSelected,
}: {
  selectedCount: number;
  onClear: () => void;
  onRegenerateSelected: () => void;
  onSelectAll: () => void;
  isAllSelected: boolean;
}) => {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-900 rounded-lg shadow-lg border p-4 flex items-center gap-4 z-50">
      <span className="font-medium">{selectedCount} Selected</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onSelectAll}>
          {isAllSelected ? "Deselect All" : "Select All"}
        </Button>
        <Button variant="ghost" onClick={onClear}>
          Cancel
        </Button>
        <Button
          variant="default"
          onClick={onRegenerateSelected}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Regenerate Selection
        </Button>
      </div>
    </div>
  );
};

export default function TokensPage({ params }: { params: { id: string } }) {
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
  const [maxPossibleCombinations, setMaxPossibleCombinations] =
    useState<number>(0);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [debouncedTokenAmount, setDebouncedTokenAmount] = useState<number>(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const pageSize = 20; // Number of tokens to load per page
  const loadMoreRef = useRef(null);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<Set<number>>(new Set());

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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedTokenAmount !== collection?.tokenAmount) {
        handleTokenAmountChange(debouncedTokenAmount);
      }
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [debouncedTokenAmount]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (
          first.isIntersecting &&
          hasMore &&
          !isLoadingMore &&
          !isLoading &&
          !searchQuery &&
          selectedTraits.size === 0
        ) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, isLoadingMore, isLoading, searchQuery, selectedTraits]);

  useEffect(() => {
    setPage(1);
    setTokens([]);
    fetchTokens(1);
  }, [searchQuery, selectedTraits]);

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

  const fetchTokens = async (pageNumber = 1) => {
    try {
      if (pageNumber === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const searchParams = new URLSearchParams({
        preview: "true",
        address: address || "",
        page: pageNumber.toString(),
        pageSize: pageSize.toString(),
      });

      // Handle token number search differently
      const tokenNumberSearch = parseInt(searchQuery);
      if (!isNaN(tokenNumberSearch)) {
        searchParams.set("tokenNumber", tokenNumberSearch.toString());
        searchParams.set("pageSize", "1"); // Only fetch the specific token
      } else if (searchQuery) {
        searchParams.append("search", searchQuery);
        searchParams.set("pageSize", "1000"); // Load more tokens for text search
      }

      const response = await fetch(
        `/api/collections/${params.id}/tokens?${searchParams.toString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch tokens");
      const data = await response.json();

      if (pageNumber === 1) {
        setTokens(data.tokens);
      } else {
        setTokens((prev) => [...prev, ...data.tokens]);
      }

      setHasMore(data.hasMore && !searchQuery); // Disable infinite scroll when searching
      setIsLoading(false);
      setIsLoadingMore(false);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch tokens",
        variant: "destructive",
      });
      setIsLoading(false);
      setIsLoadingMore(false);
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
      // Generate new seed
      const response = await fetch(`/api/collections/${params.id}/seed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) throw new Error("Failed to regenerate seed");

      toast({
        title: "Success",
        description: "Tokens regenerated successfully",
      });

      // Fetch updated tokens with new seed
      await fetchTokens();
      setRegenerateDialogOpen(false); // Close the dialog after successful regeneration
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
      const response = await fetch(
        `/api/collections/${params.id}/tokens/amount`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address,
            tokenAmount: value,
            attributes, // Pass current attributes to help with generation
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to update token amount");

      toast({
        title: "Success",
        description: "Token amount updated successfully",
      });

      // Fetch updated collection and tokens
      await fetchCollection();
      setPage(1); // Reset pagination
      setTokens([]); // Clear existing tokens
      await fetchTokens(1); // Fetch first page of updated tokens
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

  const filteredTokens = tokens.filter((token) => {
    // When using search query, tokens are already filtered from the backend
    if (searchQuery) return true;

    // Only apply client-side filtering for trait selection
    if (selectedTraits.size > 0) {
      return token.traits.some((trait) => selectedTraits.has(trait.id));
    }
    return true;
  });

  // const generateTokenMetadata = (token: Token) => {
  //   if (!collection) return null;

  //   const tokenName = collection.tokenNamePattern
  //     ? collection.tokenNamePattern
  //         .replace("{collection}", collection.name || "Collection")
  //         .replace("{id}", token.tokenNumber.toString())
  //     : `${collection.name || "Collection"} #${token.tokenNumber}`;

  //   const metadata = {
  //     name: tokenName,
  //     description: collection.description || "",
  //     image: "ipfs://<CID>",
  //     attributes: token.traits.map((trait) => {
  //       const attribute = attributes.find(
  //         (attr) => attr.id === trait.attributeId
  //       );
  //       return {
  //         trait_type: attribute?.name || "",
  //         value: trait.name,
  //       };
  //     }),
  //   };

  //   return JSON.stringify(metadata, null, 2);
  // };

  const loadMore = async () => {
    if (isLoadingMore || !hasMore || isLoading) return;
    setIsLoadingMore(true);
    await fetchTokens(page + 1);
    setPage((prev) => prev + 1);
  };

  const TokenSkeleton = () => (
    <div className="relative aspect-square border rounded-lg overflow-hidden">
      <Skeleton className="w-full h-full" />
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <Skeleton className="h-4 w-3/4 mx-auto" />
      </div>
    </div>
  );

  const handleTokenSelect = (tokenNumber: number) => {
    const newSelected = new Set(selectedTokens);
    if (newSelected.has(tokenNumber)) {
      newSelected.delete(tokenNumber);
    } else {
      newSelected.add(tokenNumber);
    }
    setSelectedTokens(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedTokens.size === filteredTokens.length) {
      setSelectedTokens(new Set());
    } else {
      setSelectedTokens(new Set(filteredTokens.map((t) => t.tokenNumber)));
    }
  };

  const handleRegenerateSelected = async () => {
    try {
      setIsRegenerating(true);
      const response = await fetch(
        `/api/collections/${params.id}/tokens/regenerate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address,
            tokenNumbers: Array.from(selectedTokens),
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to regenerate tokens");

      toast({
        title: "Success",
        description: "Selected tokens regenerated successfully",
      });

      // Reset selection and refresh tokens
      setSelectedTokens(new Set());
      setSelectMode(false);
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

  if (!isConnected || !address) {
    return null;
  }

  return (
    <div className="flex flex-col flex-1 p-4">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={newTokenAmount}
              min={1}
              max={maxPossibleCombinations}
              disabled={isRegenerating}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 0;
                setNewTokenAmount(value);
                setDebouncedTokenAmount(value);
              }}
              className="w-24"
            />
            <span className="text-sm text-gray-500">
              / {maxPossibleCombinations}
            </span>
            <Button
              variant="outline"
              disabled={
                isRegenerating || newTokenAmount === collection?.tokenAmount
              }
              onClick={() => handleTokenAmountChange(newTokenAmount)}
            >
              Save
            </Button>
          </div>

          <Dialog
            open={regenerateDialogOpen}
            onOpenChange={setRegenerateDialogOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="gap-2"
                disabled={isRegenerating}
              >
                <RefreshCw
                  className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`}
                />
                {isRegenerating ? "Regenerating..." : "Regenerate All"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Regenerate Collection</DialogTitle>
                <DialogDescription>
                  This will regenerate all tokens with new random combinations
                  using a new seed. This action cannot be undone.
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
        <div className="flex items-center gap-4 ">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by token #, attribute or trait name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={selectMode}
                onCheckedChange={setSelectMode}
                aria-label="Select tokens"
              />
              <span className="text-sm">Select Tokens</span>
            </div>
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTokens.map((token) => (
              <div
                key={token.tokenNumber}
                className={`relative aspect-square border rounded-lg overflow-hidden bg-[#f5f5f5] group hover:border-primary transition-colors cursor-pointer ${
                  selectMode && selectedTokens.has(token.tokenNumber)
                    ? "ring-2 ring-primary"
                    : ""
                }`}
                onClick={() => {
                  if (selectMode) {
                    handleTokenSelect(token.tokenNumber);
                  } else {
                    setSelectedToken(token);
                  }
                }}
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
                  ))}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  {collection?.tokenNamePattern
                    ? collection.tokenNamePattern
                        .replace(
                          "{collection}",
                          collection.name || "Collection"
                        )
                        .replace("{id}", token.tokenNumber.toString())
                    : `${collection?.name || "Collection"} #${
                        token.tokenNumber
                      }`}
                </div>
              </div>
            ))}

            {(isLoading ||
              (isLoadingMore && !searchQuery && selectedTraits.size === 0)) && (
              <>
                {Array.from({ length: pageSize }).map((_, index) => (
                  <TokenSkeleton key={`skeleton-${index}`} />
                ))}
              </>
            )}

            {hasMore && !searchQuery && selectedTraits.size === 0 && (
              <div
                ref={loadMoreRef}
                className="col-span-full flex justify-center p-4"
              >
                {isLoadingMore ? (
                  <div className="animate-pulse flex space-x-4">
                    <div className="h-4 w-4 bg-primary/10 rounded-full"></div>
                    <div className="h-4 w-4 bg-primary/10 rounded-full"></div>
                    <div className="h-4 w-4 bg-primary/10 rounded-full"></div>
                  </div>
                ) : (
                  <div className="h-4" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={!!selectedToken}
        onOpenChange={(open) => !open && setSelectedToken(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {collection?.tokenNamePattern
                ? collection.tokenNamePattern
                    .replace("{collection}", collection.name || "Collection")
                    .replace(
                      "{id}",
                      selectedToken?.tokenNumber.toString() || ""
                    )
                : `${collection?.name || "Collection"} #${
                    selectedToken?.tokenNumber
                  }`}
            </DialogTitle>
            <DialogDescription>Token details and properties</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="relative aspect-square bg-checkerboard rounded-lg overflow-hidden">
                {selectedToken?.traits
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
                  ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-3">Properties</h3>
              <div className="space-y-2">
                {selectedToken?.metadata.attributes.map((attr, index) => {
                  const trait = selectedToken.traits.find((t) => {
                    const attribute = attributes.find(
                      (a) => a.id === t.attributeId
                    );
                    return (
                      attribute?.name === attr.trait_type &&
                      t.name === attr.value
                    );
                  });

                  if (!trait) return null;

                  const tokenCount = getTraitTokenCount(trait.id);
                  const percentage = (
                    (tokenCount / tokens.length) *
                    100
                  ).toFixed(1);

                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {attr.trait_type}
                      </span>
                      <div className="flex items-center gap-2">
                        <span>{attr.value}</span>
                        <span className="text-xs text-muted-foreground">
                          ({percentage}%)
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedToken(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectMode && (
        <SelectionBar
          selectedCount={selectedTokens.size}
          onClear={() => {
            setSelectMode(false);
            setSelectedTokens(new Set());
          }}
          onRegenerateSelected={handleRegenerateSelected}
          onSelectAll={handleSelectAll}
          isAllSelected={selectedTokens.size === filteredTokens.length}
        />
      )}
    </div>
  );
}
