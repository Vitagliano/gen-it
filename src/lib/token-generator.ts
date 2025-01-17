import { Collection, Template, Trait, Attribute } from '@prisma/client';
import crypto from 'crypto';

interface TokenTraits {
  tokenNumber: number;
  traitIds: string[];
}

/**
 * Generates a deterministic random number between 0 and 1 based on a seed and index
 */
function seededRandom(seed: string, index: number): number {
  const hash = crypto.createHash('sha256')
    .update(`${seed}-${index}`)
    .digest('hex');
  
  // Convert first 8 bytes of hash to a number between 0 and 1
  const num = parseInt(hash.slice(0, 8), 16);
  return num / 0xffffffff;
}

/**
 * Selects a trait based on rarity weights using seeded random number
 */
function seededWeightedRandom<T extends { id: string; rarity: number }>(
  items: T[],
  seed: string,
  index: number
): T | null {
  if (!items.length) return null;
  
  const totalWeight = items.reduce((acc, item) => acc + item.rarity, 0);
  if (totalWeight <= 0) return items[0];
  
  const random = seededRandom(seed, index) * totalWeight;
  let currentWeight = 0;
  
  for (const item of items) {
    currentWeight += item.rarity;
    if (random <= currentWeight) {
      return item;
    }
  }
  
  return items[0];
}

/**
 * Generates a unique combination of traits for a token based on the collection seed
 */
function generateTokenTraits(
  collection: Collection & {
    attributes: (Attribute & { traits: Trait[] })[];
    templates: (Template & { attributes: { attributeId: string; enabled: boolean }[] })[];
  },
  tokenNumber: number
): TokenTraits | null {
  if (!collection.seed) return null;

  // Select template using seeded random
  const template = seededWeightedRandom(
    collection.templates,
    `${collection.seed}-template`,
    tokenNumber
  );
  
  if (!template) return null;

  // Generate traits based on template's enabled attributes
  const selectedTraits = collection.attributes
    .filter(attr => {
      const templateAttribute = template.attributes.find(
        ta => ta.attributeId === attr.id
      );
      return templateAttribute?.enabled;
    })
    .map((attr, attrIndex) => {
      if (!attr.traits.length) return null;
      
      const selectedTrait = seededWeightedRandom(
        attr.traits,
        `${collection.seed}-${tokenNumber}-${attrIndex}`,
        tokenNumber
      );
      
      return selectedTrait?.id || null;
    })
    .filter(Boolean) as string[];

  return {
    tokenNumber,
    traitIds: selectedTraits,
  };
}

/**
 * Generates metadata for a token based on its traits
 */
function generateTokenMetadata(
  collection: Collection & {
    attributes: (Attribute & { traits: Trait[] })[];
  },
  traits: string[]
) {
  const metadata: Record<string, any> = {
    name: `${collection.name} #${collection.startAtZero ? 0 : 1}`,
    description: collection.description || '',
    attributes: [] as Record<string, string>[],
  };

  // Map trait IDs to their attribute names and values
  traits.forEach(traitId => {
    const attribute = collection.attributes.find(attr =>
      attr.traits.some(trait => trait.id === traitId)
    );
    const trait = attribute?.traits.find(t => t.id === traitId);
    
    if (attribute && trait) {
      metadata.attributes.push({
        trait_type: attribute.name,
        value: trait.name,
      });
    }
  });

  return metadata;
}

export {
  seededRandom,
  seededWeightedRandom,
  generateTokenTraits,
  generateTokenMetadata,
  type TokenTraits,
}; 