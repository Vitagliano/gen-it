export type SiteConfig = {
  name: string;
  author: string;
  description: string;
  keywords: Array<string>;
  url: {
    base: string;
    author: string;
  };
  links: {
    twitter: string;
  };
  ogImage: string;
};

export interface Trait {
  id: string;
  name: string;
  imagePath: string;
  attributeId: string;
  isEnabled?: boolean;
  rarity?: number;
}

export interface Token {
  id: string;
  tokenNumber: number;
  traits: Trait[];
  metadata?: {
    name: string;
    description: string;
    attributes: Array<{
      trait_type: string;
      value: string;
    }>;
  };
}

export interface Attribute {
  id: string;
  name: string;
  order: number;
  traits?: Trait[];
}
