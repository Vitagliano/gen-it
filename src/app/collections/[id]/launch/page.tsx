"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

export default function LaunchPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { address } = useAccount();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Poll for progress updates
  useEffect(() => {
    if (!isExporting || !address) return;

    const checkProgress = async () => {
      try {
        const response = await fetch(
          `/api/collections/${params.id}/tokens/export?address=${address}`,
          { method: "GET" }
        );

        if (!response.ok) throw new Error("Failed to check export progress");

        const data = await response.json();
        setProgress(data.progress);

        if (data.progress === -1) {
          throw new Error("Export failed");
        }

        if (data.isComplete) {
          setIsComplete(true);
          setIsExporting(false);
          toast({
            title: "Success",
            description:
              "Collection exported successfully. Click Download to save the files.",
          });
        }
      } catch (error) {
        console.error("Error checking progress:", error);
        setIsExporting(false);
        toast({
          title: "Error",
          description: "Failed to check export progress",
          variant: "destructive",
        });
      }
    };

    const interval = setInterval(checkProgress, 1000);
    return () => clearInterval(interval);
  }, [isExporting, address, params.id, toast]);

  const handleExport = async () => {
    if (!address) return;

    try {
      setIsExporting(true);
      setProgress(0);
      setIsComplete(false);

      const response = await fetch(
        `/api/collections/${params.id}/tokens/export`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ address }),
        }
      );

      if (!response.ok) throw new Error("Failed to start export");
    } catch (error) {
      console.error("Error:", error);
      setIsExporting(false);
      toast({
        title: "Error",
        description: "Failed to start export",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async () => {
    if (!address || !isComplete) return;

    try {
      const response = await fetch(
        `/api/collections/${params.id}/tokens/export?address=${address}&download=true`,
        { method: "GET" }
      );

      if (!response.ok) throw new Error("Failed to download export");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "collection-export.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading:", error);
      toast({
        title: "Error",
        description: "Failed to download export",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col flex-1 p-4">
      <div className="flex items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold">Launch Collection</h1>
      </div>

      <div className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Launch Configuration</h2>
        <p className="text-muted-foreground mb-6">
          Export your collection to download all token images and metadata
          files. This will generate a zip file containing PNG images and JSON
          metadata for each token.
        </p>

        <div className="space-y-4">
          {(isExporting || isComplete) && (
            <div className="w-full">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground mt-2">
                {isExporting
                  ? `Generating files... ${progress}%`
                  : "Generation complete"}
              </p>
            </div>
          )}

          <div className="flex gap-4">
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
                "Export Collection"
              )}
            </Button>

            {isComplete && (
              <Button
                onClick={handleDownload}
                className="w-full md:w-auto"
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Files
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
