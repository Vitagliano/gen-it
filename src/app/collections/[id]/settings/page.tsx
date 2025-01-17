"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Collection {
  id: string;
  name: string;
  tokenAmount: number;
  dimensions: { width: number; height: number };
  format: "PNG" | "JPG" | "GIF" | "SVG";
  pixelated: boolean;
  metadataFormat: "Ethereum" | "Solana" | "Other";
  tokenNamePattern: string;
  description?: string;
  tokens?: Token[];
}

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

export default function SettingsPage({ params }: { params: { id: string } }) {
  const { address, isConnected } = useAccount();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState<Partial<Collection>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [attributes, setAttributes] = useState<Attribute[]>([]);

  useEffect(() => {
    const fetchCollection = async () => {
      if (!isConnected || !address) return;

      try {
        const [collectionResponse, tokensResponse, attributesResponse] = await Promise.all([
          fetch(`/api/collections/${params.id}?address=${address}`),
          fetch(`/api/collections/${params.id}/tokens?preview=true&address=${address}`),
          fetch(`/api/collections/${params.id}/attributes?address=${address}`),
        ]);

        if (!collectionResponse.ok || !tokensResponse.ok || !attributesResponse.ok)
          throw new Error("Failed to fetch data");

        const [collectionData, tokensData, attributesData] = await Promise.all([
          collectionResponse.json(),
          tokensResponse.json(),
          attributesResponse.json(),
        ]);

        setCollection({
          ...collectionData,
          tokens: tokensData,
        });
        setAttributes(attributesData);
        setUnsavedChanges({});
      } catch (error) {
        console.error("Failed to fetch collection:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCollection();
  }, [params.id, address, isConnected]);

  const handleChange = async (
    field: string,
    value: string | number | boolean | { width: number; height: number }
  ) => {
    setUnsavedChanges((prev) => ({
      ...prev,
      [field]: value,
    }));

    // If changing pixelated setting, no need to wait for save to update preview
    if (field === 'pixelated') {
      setCollection(prev => prev ? {
        ...prev,
        pixelated: value as boolean
      } : null);
    }
  };

  const handleSave = async () => {
    if (!address || !collection || Object.keys(unsavedChanges).length === 0)
      return;

    try {
      const response = await fetch(
        `/api/collections/${params.id}?address=${address}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(unsavedChanges),
        }
      );

      if (!response.ok) throw new Error("Failed to update collection");

      const updatedCollection = await response.json();
      
      // Fetch new preview tokens after updating collection
      const tokensResponse = await fetch(
        `/api/collections/${params.id}/tokens?preview=true&address=${address}`
      );
      
      if (!tokensResponse.ok) throw new Error("Failed to fetch preview tokens");
      
      const tokensData = await tokensResponse.json();

      setCollection({
        ...updatedCollection,
        tokens: tokensData,
      });
      setUnsavedChanges({});
    } catch (error) {
      console.error("Failed to update collection:", error);
    }
  };

  const handleDiscard = () => {
    setUnsavedChanges({});
  };

  const hasChanges = Object.keys(unsavedChanges).length > 0;

  const generateMetadataPreview = () => {
    if (!collection) return null;

    const tokenName = collection.tokenNamePattern
      ? collection.tokenNamePattern
          .replace("{collection}", collection.name || "Collection")
          .replace("{id}", "1")
      : `${collection.name || "Collection"} #1`;

    const sampleMetadata = {
      attributes: [
        {
          trait_type: "bg",
          value: "Camada-33#100",
        },
        {
          trait_type: "clothes",
          value: "maid#100",
        },
        {
          trait_type: "eyes",
          value: "bored#100",
        },
      ],
      description: collection.description || "",
      image: "ipfs://<CID>",
      name: tokenName,
    };

    return JSON.stringify(sampleMetadata, null, 2);
  };

  if (!isConnected || !address) {
    return null;
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col flex-1 p-4 max-w-[1200px]">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your collection settings.
        </p>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">General</h2>
        <p className="text-muted-foreground">
          Manage your collection&lsquo;s base settings.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-8">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <p className="text-sm text-muted-foreground">
                Your Collection&lsquo;s name.
              </p>
            </div>
            <Input
              id="name"
              value={unsavedChanges.name ?? collection?.name ?? ""}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g. Bored Ape Yacht Club"
            />
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="tokenAmount">Token Count</Label>
              <p className="text-sm text-muted-foreground">
                The amount of Tokens the generator will create for your
                Collection.
              </p>
            </div>
            <Input
              id="tokenAmount"
              type="number"
              value={
                unsavedChanges.tokenAmount ?? collection?.tokenAmount ?? ""
              }
              onChange={(e) =>
                handleChange("tokenAmount", parseInt(e.target.value))
              }
              placeholder="1000"
            />
          </div>
        </div>

        <div>
          <div className="sticky top-4">
            <p className="text-sm font-medium mb-3">Preview</p>
            <Card className="overflow-hidden">
              {collection?.tokens?.[0] ? (
                <div className="relative aspect-square bg-[#f5f5f5] bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee),linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]">
                  {collection.tokens[0].traits
                    .sort((a, b) => {
                      const attrA = attributes.find(attr => attr.id === a.attributeId);
                      const attrB = attributes.find(attr => attr.id === b.attributeId);
                      return (attrA?.order || 0) - (attrB?.order || 0);
                    })
                    .map((trait) => (
                      <div key={trait.id} className="absolute inset-0">
                        <img
                          src={`/${trait.imagePath}`}
                          alt={trait.name}
                          className={
                            (
                              typeof unsavedChanges.pixelated !== "undefined"
                                ? unsavedChanges.pixelated
                                : collection.pixelated
                            )
                              ? "object-contain w-full h-full image-rendering-pixelated"
                              : "object-contain w-full h-full"
                          }
                        />
                      </div>
                    ))}
                </div>
              ) : (
                <div className="aspect-square bg-muted flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    No preview available
                  </p>
                </div>
              )}
              <div className="p-3 border-t">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {unsavedChanges.name || collection?.name || "Collection Name"}
                  </span>
                  <span className="text-muted-foreground">
                    {unsavedChanges.tokenAmount || collection?.tokenAmount || 0}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-lg font-semibold">Artwork</h2>
        <p className="text-muted-foreground">
          Manage how your artwork is exported and animates.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-8">
          <div className="space-y-4">
            <div>
              <Label htmlFor="dimensions">Dimensions (px)</Label>
              <p className="text-sm text-muted-foreground">
                The size of the token assets. Max 2400px and 2000px for GIFs
              </p>
            </div>
            <Input
              id="dimensions"
              type="number"
              value={
                unsavedChanges.dimensions?.width ??
                collection?.dimensions?.width ??
                ""
              }
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (value <= 2400) {
                  handleChange("dimensions", { width: value, height: value });
                }
              }}
              placeholder="1200"
            />
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="format">Format</Label>
              <p className="text-sm text-muted-foreground">
                Output format for your Tokens
              </p>
            </div>
            <Select
              value={unsavedChanges.format ?? collection?.format ?? "PNG"}
              onValueChange={(value) => handleChange("format", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PNG">PNG</SelectItem>
                <SelectItem value="JPG">JPG</SelectItem>
                <SelectItem value="GIF">GIF</SelectItem>
                <SelectItem value="SVG">SVG</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Enable Pixel Art Style</Label>
              <p className="text-sm text-muted-foreground">
                No Anti-Aliasing / Compression. Ensures pixels will always
                remain sharp.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={
                  unsavedChanges.pixelated ?? collection?.pixelated ?? false
                }
                onCheckedChange={(checked) =>
                  handleChange("pixelated", checked)
                }
              />
            </div>
          </div>
        </div>

        <div>
          <div className="sticky top-4">
            <p className="text-sm font-medium mb-3">Preview</p>
            <Card className="overflow-hidden">
              {collection?.tokens?.[0] ? (
                <div className="relative aspect-square bg-[#f5f5f5] bg-[linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee),linear-gradient(45deg,#eee_25%,transparent_25%,transparent_75%,#eee_75%,#eee)] bg-[length:16px_16px] bg-[position:0_0,8px_8px]">
                  {collection.tokens[0].traits
                    .sort((a, b) => {
                      const attrA = attributes.find(attr => attr.id === a.attributeId);
                      const attrB = attributes.find(attr => attr.id === b.attributeId);
                      return (attrA?.order || 0) - (attrB?.order || 0);
                    })
                    .map((trait) => (
                      <div key={trait.id} className="absolute inset-0">
                        <img
                          src={`/${trait.imagePath}`}
                          alt={trait.name}
                          className={
                            (
                              typeof unsavedChanges.pixelated !== "undefined"
                                ? unsavedChanges.pixelated
                                : collection.pixelated
                            )
                              ? "object-contain w-full h-full image-rendering-pixelated"
                              : "object-contain w-full h-full"
                          }
                        />
                      </div>
                    ))}
                </div>
              ) : (
                <div className="aspect-square bg-muted flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    No preview available
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-lg font-semibold">Metadata</h2>
        <p className="text-muted-foreground">
          Manage how your metadata is formatted.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-8">
          <div className="space-y-4">
            <div>
              <Label htmlFor="metadataFormat">Format</Label>
              <p className="text-sm text-muted-foreground">
                The network format for exported metadata.
              </p>
            </div>
            <Select
              value={
                unsavedChanges.metadataFormat ??
                collection?.metadataFormat ??
                "Ethereum"
              }
              onValueChange={(value) => handleChange("metadataFormat", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ethereum">Ethereum</SelectItem>
                <SelectItem value="Solana">Solana</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="tokenNamePattern">Token Name</Label>
              <p className="text-sm text-muted-foreground">
                The naming pattern used to generate a name for each Token.
              </p>
            </div>
            <Input
              id="tokenNamePattern"
              value={
                unsavedChanges.tokenNamePattern ??
                collection?.tokenNamePattern ??
                "{collection} #{id}"
              }
              onChange={(e) => handleChange("tokenNamePattern", e.target.value)}
              placeholder="{collection} #{id}"
            />
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="description">Token Description</Label>
              <p className="text-sm text-muted-foreground">
                A human readable description of your Collection. Markdown is
                supported.
              </p>
            </div>
            <Textarea
              id="description"
              value={
                unsavedChanges.description ?? collection?.description ?? ""
              }
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="A short description for tokens..."
              className="min-h-[100px]"
            />
          </div>
        </div>

        <div>
          <div className="sticky top-4">
            <p className="text-sm font-medium mb-3">Preview</p>
            <Card className="overflow-hidden">
              <div className="p-4 font-mono text-sm">
                <pre className="whitespace-pre-wrap break-all">
                  {generateMetadataPreview()}
                </pre>
              </div>
            </Card>
          </div>
        </div>
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
              onClick={handleSave}
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
