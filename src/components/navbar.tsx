import Link from "next/link";
import { ConnectButton } from "@/components/connect-button";

export function Navbar() {
  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <Link href="/collections" className="font-semibold text-lg">
          NFT Generator
        </Link>
        <div className="ml-auto">
          <ConnectButton />
        </div>
      </div>
    </div>
  );
} 