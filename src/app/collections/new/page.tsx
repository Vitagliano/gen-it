"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

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

interface PreviewTrait {
  name: string;
  base64: string;
}

interface PreviewAttribute {
  name: string;
  traits: PreviewTrait[];
}

interface UploadProgress {
  status: "creating" | "uploading" | "processing" | "done" | "error";
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
  const [previewAttributes, setPreviewAttributes] = useState<
    PreviewAttribute[]
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    status: "done",
  });
  const [collectionId, setCollectionId] = useState<string | null>(null);

  console.log("attributes", attributes);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !address) return;

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

    // Generate previews first
    const previewAttributesData: PreviewAttribute[] = [];
    for (const [attributeName, files] of Array.from(
      filesByAttribute.entries()
    )) {
      const previewTraits: PreviewTrait[] = [];
      for (const file of files) {
        try {
          const base64 = await fileToBase64(file);
          const traitName = file.name.replace(/\.[^/.]+$/, "");
          previewTraits.push({ name: traitName, base64 });
        } catch (error) {
          console.error("Error generating preview for", file.name, error);
        }
      }
      previewAttributesData.push({
        name: attributeName,
        traits: previewTraits,
      });
    }
    setPreviewAttributes(previewAttributesData);

    setIsUploading(true);
    setUploadProgress({ status: "creating" });

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

      // Start uploading attributes in the background
      setUploadProgress({
        status: "uploading",
        totalAttributes: filesByAttribute.size,
        processedAttributes: 0,
      });

      // Upload each attribute and its files
      let processed = 0;
      for (const [attributeName, files] of Array.from(
        filesByAttribute.entries()
      )) {
        setUploadProgress((prev) => ({
          ...prev,
          currentAttribute: attributeName,
          processedAttributes: processed,
        }));

        const formData = new FormData();
        formData.append("name", attributeName);
        formData.append("order", processed.toString());
        formData.append("address", address);
        files.forEach((file) => {
          formData.append("files", file);
        });

        try {
          const response = await fetch(
            `/api/collections/${collection.id}/attributes`,
            {
              method: "POST",
              body: formData,
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to upload ${attributeName}`);
          }

          const responseData = await response.json();
          console.log(`Successfully uploaded ${attributeName}:`, responseData);
        } catch (error) {
          console.error(`Error uploading ${attributeName}:`, error);
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : `Failed to upload ${attributeName}`,
            variant: "destructive",
          });
          continue;
        }

        processed++;
      }

      setUploadProgress({ status: "processing" });
      await fetchAttributes(collection.id);

      setUploadProgress({ status: "done" });
      toast({
        title: "Success",
        description: "Assets uploaded successfully",
      });

      // Navigate to the collection page
      router.push(`/collections/${collection.id}/manage/attributes`);
    } catch (error) {
      console.error("Error:", error);
      setUploadProgress({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to upload files",
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

  const fetchAttributes = async (collectionId: string) => {
    try {
      if (!address) return;
      
      const response = await fetch(
        `/api/collections/${collectionId}/attributes?address=${address}`
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch attributes");
      }
      
      const data = await response.json();
      setAttributes(data);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to fetch attributes",
        variant: "destructive",
      });
    }
  };

  // const renderUploadStatus = () => {
  //   switch (uploadProgress.status) {
  //     case "creating":
  //       return (
  //         <div className="flex items-center gap-2 text-blue-600">
  //           <Loader2 className="w-4 h-4 animate-spin" />
  //           Creating collection...
  //         </div>
  //       );
  //     case "uploading":
  //       return (
  //         <div className="space-y-2">
  //           <div className="flex items-center gap-2 text-blue-600">
  //             <Loader2 className="w-4 h-4 animate-spin" />
  //             Uploading {uploadProgress.currentAttribute}...
  //           </div>
  //           <div className="text-sm text-gray-500">
  //             Progress: {uploadProgress.processedAttributes} of{" "}
  //             {uploadProgress.totalAttributes} attributes
  //           </div>
  //           <div className="w-full bg-gray-200 rounded-full h-2">
  //             <div
  //               className="bg-blue-600 h-2 rounded-full transition-all duration-300"
  //               style={{
  //                 width: `${
  //                   (uploadProgress.processedAttributes! /
  //                     uploadProgress.totalAttributes!) *
  //                   100
  //                 }%`,
  //               }}
  //             />
  //           </div>
  //         </div>
  //       );
  //     case "processing":
  //       return (
  //         <div className="flex items-center gap-2 text-blue-600">
  //           <Loader2 className="w-4 h-4 animate-spin" />
  //           Processing attributes...
  //         </div>
  //       );
  //     case "error":
  //       return (
  //         <div className="text-red-600">Error: {uploadProgress.error}</div>
  //       );
  //     default:
  //       return null;
  //   }
  // };

  if (!isConnected || !address) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">
            {previewAttributes.length > 0
              ? "SETUP COLLECTION"
              : "Create New Collection"}
          </h1>
          {previewAttributes.length > 0 && (
            <p className="text-gray-500 mt-2">
              {previewAttributes.length} Components
            </p>
          )}
        </div>
        {isUploading ? (
          <div className="flex items-center gap-2">
            <div className="text-sm text-purple-600">
              Uploading assets{" "}
              {Math.round(
                ((uploadProgress.processedAttributes || 0) /
                  (uploadProgress.totalAttributes || 1)) *
                  100
              )}
              %
            </div>
          </div>
        ) : (
          collectionId &&
          uploadProgress.status === "done" && (
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => router.push(`/collections/${collectionId}/layers`)}
            >
              Next →
            </Button>
          )
        )}
      </div>

      <div className="space-y-8">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
            previewAttributes.length > 0 ? "border-gray-200" : "border-gray-300"
          }`}
        >
          <div
            className={`transition-all duration-300 ${
              previewAttributes.length > 0 ? "scale-90" : "scale-100"
            }`}
          >
            <div className="text-2xl font-semibold mb-2">
              {previewAttributes.length > 0
                ? "Upload more assets"
                : "Upload your collection folder"}
            </div>
            <p className="text-gray-500 mb-4">
              <label className="text-blue-500 cursor-pointer hover:underline">
                Choose a folder
                <input
                  type="file"
                  className="hidden"
                  // @ts-expect-error: `webkitdirectory` is not recognized by TypeScript on the input element
                  webkitdirectory=""
                  directory=""
                  onChange={handleFolderSelect}
                  accept="image/png,image/jpeg,image/svg+xml"
                  disabled={isUploading}
                />
              </label>{" "}
              to get started
            </p>
          </div>
        </div>

        {previewAttributes.length > 0 && (
          <div className="space-y-8">
            {previewAttributes.map((attribute) => (
              <div key={attribute.name} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-lg">{attribute.name}</h3>
                  <span className="text-sm text-gray-500">
                    {attribute.traits.length} traits
                  </span>
                </div>
                <div className="overflow-x-auto pb-4">
                  <div
                    className="flex gap-4"
                    style={{ minWidth: "min-content" }}
                  >
                    {attribute.traits.map((trait) => (
                      <div key={trait.name} className="w-32 flex-shrink-0">
                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-2">
                          <img
                            src={trait.base64}
                            alt={trait.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="text-sm truncate text-center">
                          {trait.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
