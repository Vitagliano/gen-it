import { env } from "@/env";
import { SiteConfig } from "@/types";

export const siteConfig: SiteConfig = {
  name: "Gen It",
  author: "Vitagliano",
  description: "Generate your own NFT collection.",
  keywords: ["nft", "collection", "generator"],
  url: {
    base: env.NEXT_PUBLIC_APP_URL,
    author: "https://gabrielrusso.me",
  },
  links: {
    twitter: "https://x.com/gabrielrvita",
  },
  ogImage: `${env.NEXT_PUBLIC_APP_URL}/og.jpg`,
};
