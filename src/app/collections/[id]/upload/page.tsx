"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";

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

export default function UploadPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [isUploading, setIsUploading] = useState(false);

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

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Group files by their parent directory (attribute)
    const filesByAttribute = new Map<string, File[]>();
    
    Array.from(files).forEach((file) => {
      // Get the path parts from webkitRelativePath: "collectionName/attributeName/fileName"
      const pathParts = file.webkitRelativePath.split("/");
      
      if (pathParts.length >= 3) {
        const attributeName = pathParts[1];
        const existingFiles = filesByAttribute.get(attributeName) || [];
        filesByAttribute.set(attributeName, [...existingFiles, file]);
      }
    });

    setIsUploading(true);

    try {
      // Upload each attribute and its files
      for (const [attributeName, files] of filesByAttribute.entries()) {
        const formData = new FormData();
        formData.append("name", attributeName);
        formData.append("order", attributes.length.toString());
        formData.append("address", address as string);
        files.forEach((file) => {
          formData.append("files", file);
        });

        const response = await fetch(`/api/collections/${params.id}/attributes`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || `Failed to upload ${attributeName}`);
        }
      }

      fetchAttributes();
      toast({
        title: "Success",
        description: "Attributes uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading files:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (!isConnected || !address) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Setup Collection</h1>
        <div className="text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-gray-600">Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</span>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="border-2 border-dashed rounded-lg p-12 text-center">
          <div className="text-2xl font-semibold mb-2">
            Drag n drop your art here!
          </div>
          <p className="text-gray-500 mb-4">
            Or <label className="text-blue-500 cursor-pointer hover:underline">
              choose a folder
              <input
                type="file"
                webkitdirectory=""
                directory=""
                className="hidden"
                onChange={handleFolderSelect}
                accept="image/png,image/jpeg,image/svg+xml"
              />
            </label> to get started
          </p>
          {isUploading && (
            <div className="text-blue-600">
              Uploading assets...
            </div>
          )}
        </div>
      </div>

      {attributes.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Uploaded Attributes</h2>
          <div className="space-y-6">
            {attributes.map((attribute) => (
              <div key={attribute.id} className="border rounded p-4">
                <h3 className="font-medium mb-2">{attribute.name}</h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {attribute.traits.map((trait) => (
                    <div key={trait.id} className="text-center">
                      <div className="relative w-full pt-[100%] mb-1">
                        <Image
                          src={`/${trait.imagePath}`}
                          alt={trait.name}
                          fill
                          className="object-contain"
                        />
                      </div>
                      <span className="text-xs truncate block">{trait.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <button
              onClick={() => router.push(`/collections/${params.id}/preview`)}
              className="bg-blue-600 text-white py-2 px-6 rounded hover:bg-blue-700"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 