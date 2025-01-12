"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Collection {
  id: string;
  name: string;
  description: string | null;
  tokenAmount: number;
  dimensions: {
    width: number;
    height: number;
  };
  format: string;
  _count?: {
    tokens: number;
  };
}

export default function CollectionsPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { toast } = useToast();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      fetchCollections();
    }
  }, [address, isConnected]);

  const fetchCollections = async () => {
    try {
      const response = await fetch(`/api/collections?address=${address}`);
      if (!response.ok) throw new Error("Failed to fetch collections");
      const data = await response.json();
      setCollections(data);
      setIsLoading(false);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to fetch collections",
        variant: "destructive",
      });
    }
  };

  const handleCollectionClick = (collection: Collection) => {
    // If collection has tokens, go to tokens page, otherwise go to layers page
    if (collection._count?.tokens && collection._count.tokens > 0) {
      router.push(`/collections/${collection.id}/tokens`);
    } else {
      router.push(`/collections/${collection.id}/layers`);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, collection: Collection) => {
    e.stopPropagation(); // Prevent triggering the card click
    setCollectionToDelete(collection);
  };

  const handleDeleteConfirm = async () => {
    if (!collectionToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/collections/${collectionToDelete.id}?address=${address}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) throw new Error("Failed to delete collection");

      toast({
        title: "Success",
        description: "Collection deleted successfully",
      });

      // Remove the deleted collection from the state
      setCollections((prev) =>
        prev.filter((c) => c.id !== collectionToDelete.id)
      );
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to delete collection",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setCollectionToDelete(null);
    }
  };

  if (!isConnected || !address) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Collections</h1>
        <Button onClick={() => router.push("/collections/new")}>
          <PlusCircle className="w-4 h-4 mr-2" />
          New Collection
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {collections.map((collection) => (
          <div
            key={collection.id}
            onClick={() => handleCollectionClick(collection)}
            className="border rounded-lg p-4 hover:border-primary cursor-pointer transition-colors group relative"
          >
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => handleDeleteClick(e, collection)}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>

            <h2 className="text-xl font-semibold mb-2">{collection.name}</h2>
            {collection.description && (
              <p className="text-gray-600 mb-4 line-clamp-2">
                {collection.description}
              </p>
            )}
            <div className="flex justify-between text-sm text-gray-500">
              <span>{collection.tokenAmount} tokens</span>
              <span>
                {collection.dimensions.width}x{collection.dimensions.height}{" "}
                {collection.format}
              </span>
            </div>
            {collection._count?.tokens && collection._count.tokens > 0 && (
              <div className="mt-2 text-sm text-primary">
                {collection._count.tokens} tokens generated
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!collectionToDelete} onOpenChange={(open) => !open && setCollectionToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Collection</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{collectionToDelete?.name}&quot;? This action is irreversible and will delete all related data including attributes, traits, and generated tokens.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCollectionToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Collection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 