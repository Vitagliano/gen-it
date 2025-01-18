import Link from "next/link";
import { ConnectButton } from "@/components/connect-button";
import { ThemeSwitcher } from "./theme-switcher";

export function Navbar() {
  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <Link href="/collections" className="font-semibold text-lg">
          NFT Generator
        </Link>
        <div className="ml-auto flex items-center gap-4">
          <ThemeSwitcher />
          <ConnectButton />
        </div>
      </div>
    </div>
  );
}
