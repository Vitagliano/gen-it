"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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
}

interface UploadProgress {
  status: 'creating' | 'uploading' | 'processing' | 'done' | 'error';
  currentAttribute?: string;
  totalAttributes?: number;
  processedAttributes?: number;
  error?: string;
}

export default function NewCollection() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ status: 'done' });
  const [collectionId, setCollectionId] = useState<string | null>(null);

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Get collection name from the root folder
    const collectionName = files[0].webkitRelativePath.split("/")[0];

    // Group files by their parent directory (attribute)
    const filesByAttribute = new Map<string, File[]>();
    Array.from(files).forEach((file) => {
      const pathParts = file.webkitRelativePath.split("/");
      if (pathParts.length >= 3) {
        const attributeName = pathParts[1];
        const existingFiles = filesByAttribute.get(attributeName) || [];
        filesByAttribute.set(attributeName, [...existingFiles, file]);
      }
    });

    setIsUploading(true);
    setUploadProgress({ status: 'creating' });

    try {
      // Create collection first with default values
      const collectionResponse = await fetch("/api/collections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: collectionName,
          description: `Collection generated from ${collectionName}`,
          tokenAmount: 100,
          dimensions: { width: 512, height: 512 },
          format: "png",
          address,
        }),
      });

      if (!collectionResponse.ok) {
        const error = await collectionResponse.json();
        throw new Error(error.error || "Failed to create collection");
      }

      const collection = await collectionResponse.json();
      setCollectionId(collection.id);

      // Start uploading attributes
      setUploadProgress({
        status: 'uploading',
        totalAttributes: filesByAttribute.size,
        processedAttributes: 0,
      });

      // Upload each attribute and its files
      let processed = 0;
      for (const [attributeName, files] of Array.from(filesByAttribute.entries())) {
        setUploadProgress(prev => ({
          ...prev,
          currentAttribute: attributeName,
          processedAttributes: processed,
        }));

        const formData = new FormData();
        formData.append("name", attributeName);
        formData.append("order", processed.toString());
        formData.append("address", address as string);
        files.forEach((file) => {
          formData.append("files", file);
        });

        const response = await fetch(
          `/api/collections/${collection.id}/attributes`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `Failed to upload ${attributeName}`);
        }

        processed++;
      }

      setUploadProgress({ status: 'processing' });
      await fetchAttributes(collection.id);
      
      setUploadProgress({ status: 'done' });
      toast({
        title: "Success",
        description: "Assets uploaded successfully",
      });
    } catch (error) {
      console.error("Error:", error);
      setUploadProgress({ 
        status: 'error',
        error: error instanceof Error ? error.message : "Failed to upload files"
      });
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const fetchAttributes = async (id: string) => {
    try {
      const response = await fetch(`/api/collections/${id}/attributes?address=${address}`);
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

  const renderUploadStatus = () => {
    switch (uploadProgress.status) {
      case 'creating':
        return (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating collection...
          </div>
        );
      case 'uploading':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-blue-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading {uploadProgress.currentAttribute}...
            </div>
            <div className="text-sm text-gray-500">
              Progress: {uploadProgress.processedAttributes} of {uploadProgress.totalAttributes} attributes
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${(uploadProgress.processedAttributes! / uploadProgress.totalAttributes!) * 100}%`
                }}
              />
            </div>
          </div>
        );
      case 'processing':
        return (
          <div className="flex items-center gap-2 text-blue-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing attributes...
          </div>
        );
      case 'error':
        return (
          <div className="text-red-600">
            Error: {uploadProgress.error}
          </div>
        );
      default:
        return null;
    }
  };

  if (!isConnected || !address) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {!collectionId ? (
        <>
          <h1 className="text-3xl font-bold mb-8">Create New Collection</h1>
          <div className="border-2 border-dashed rounded-lg p-12 text-center">
            <div className="text-2xl font-semibold mb-2">
              Upload your collection folder
            </div>
            <p className="text-gray-500 mb-4">
              <label className="text-blue-500 cursor-pointer hover:underline">
                Choose a folder
                <input
                  type="file"
                  className="hidden"
                  // @ts-ignore
                  webkitdirectory=""
                  // @ts-ignore
                  directory=""
                  onChange={handleFolderSelect}
                  accept="image/png,image/jpeg,image/svg+xml"
                  disabled={isUploading}
                />
              </label>{" "}
              to get started
            </p>
            {isUploading && (
              <div className="mt-4">
                {renderUploadStatus()}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Preview Attributes</h1>
            <Button onClick={() => router.push(`/collections/${collectionId}/layers`)}>
              Next →
            </Button>
          </div>

          <div className="space-y-6">
            {attributes.map((attribute) => (
              <div key={attribute.id} className="border rounded p-4">
                <h3 className="font-medium mb-2">{attribute.name}</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {attribute.traits.map((trait) => (
                    <div key={trait.id} className="text-center">
                      <div className="relative w-full pt-[100%] mb-1">
                        <img
                          src={`/${trait.imagePath}`}
                          alt={trait.name}
                          className="absolute inset-0 object-contain w-full h-full"
                        />
                      </div>
                      <span className="text-xs truncate block">
                        {trait.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
} 