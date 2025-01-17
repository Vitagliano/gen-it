"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function LaunchPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { address } = useAccount();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!address) return;
    
    try {
      setIsExporting(true);
      const response = await fetch(`/api/collections/${params.id}/tokens/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address }),
      });

      if (!response.ok) throw new Error("Failed to export collection");

      toast({
        title: "Success",
        description: "Collection exported successfully",
      });

      // Redirect to tokens page after successful export
      router.push(`/collections/${params.id}/tokens`);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to export collection",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 p-4">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => router.push(`/collections/`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Launch Collection</h1>
      </div>

      <div className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Launch Configuration</h2>
        <p className="text-muted-foreground mb-6">
          Export your collection to persist the current token generation. This will store all tokens in the database for future use.
        </p>
        
        <Button 
          onClick={handleExport} 
          disabled={isExporting}
          className="w-full md:w-auto"
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            'Export Collection'
          )}
        </Button>
      </div>
    </div>
  );
}
