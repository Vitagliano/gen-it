"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@/components/connect-button";

export default function Home() {
  const router = useRouter();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (isConnected) {
      router.push("/collections");
    }
  }, [isConnected, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div className="max-w-3xl space-y-6">
        <h1 className="text-6xl font-bold">Gen It</h1>
        <p className="text-xl text-muted-foreground">
          Create, manage, and launch your NFT collections with ease
        </p>
        
        <div className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground">
            Connect your wallet to get started
          </p>
          <ConnectButton />
        </div>
      </div>
    </div>
  );
}
