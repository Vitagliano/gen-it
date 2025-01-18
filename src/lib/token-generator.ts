import { Collection, Template, Trait, Attribute, TraitRule } from '@prisma/client';
import crypto from 'crypto';

interface TokenTraits {
  tokenNumber: number;
  traitIds: string[];
}

interface TokenMetadata {
  name: string;
  description: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
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
 * Checks if a trait combination is valid according to the rules
 */
function isValidTraitCombination(
  selectedTraits: string[],
  rules: (TraitRule & { traitIds: string[] })[]
): boolean {
  for (const rule of rules) {
    const [firstTraitId, ...otherTraitIds] = rule.traitIds;
    const hasFirstTrait = selectedTraits.includes(firstTraitId);

    switch (rule.ruleType) {
      case "EXCLUDE":
        if (hasFirstTrait && otherTraitIds.some(id => selectedTraits.includes(id))) {
          return false;
        }
        break;

      case "ONLY_TOGETHER":
        if (hasFirstTrait && !otherTraitIds.some(id => selectedTraits.includes(id))) {
          return false;
        }
        break;

      case "ALWAYS_TOGETHER":
        if (hasFirstTrait && !otherTraitIds.every(id => selectedTraits.includes(id))) {
          return false;
        }
        break;
    }
  }

  return true;
}

/**
 * Checks if a trait should be excluded based on the current selection
 */
function shouldExcludeTrait(
  traitId: string,
  selectedTraits: string[],
  rules: (TraitRule & { traitIds: string[] })[]
): boolean {
  for (const rule of rules) {
    const [firstTraitId, ...otherTraitIds] = rule.traitIds;

    if (rule.ruleType === "EXCLUDE") {
      if (otherTraitIds.includes(traitId) && selectedTraits.includes(firstTraitId)) {
        return true;
      }
      if (traitId === firstTraitId && otherTraitIds.some(id => selectedTraits.includes(id))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Generates a unique combination of traits for a token based on the collection seed
 */
function generateTokenTraits(
  collection: Collection & {
    attributes: (Attribute & { traits: Trait[] })[];
    templates: (Template & { attributes: { attributeId: string; enabled: boolean }[] })[];
    traitRules: (TraitRule & { traitIds: string[] })[];
  },
  tokenNumber: number
): TokenTraits | null {
  if (!collection.seed) return null;

  const template = seededWeightedRandom(
    collection.templates,
    `${collection.seed}-template`,
    tokenNumber
  );
  
  if (!template) return null;

  const MAX_ATTEMPTS = 100;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const selectedTraits: string[] = [];

    const enabledAttributes = collection.attributes.filter(attr => {
      const templateAttribute = template.attributes.find(
        ta => ta.attributeId === attr.id
      );
      return templateAttribute?.enabled;
    });

    for (const attr of enabledAttributes) {
      if (!attr.traits.length) continue;

      const shouldInclude = seededRandom(
        `${collection.seed}-${tokenNumber}-${attr.id}-include-${attempt}`,
        tokenNumber
      ) > 0.1; // 90% chance to include the attribute

      if (shouldInclude) {
        const availableTraits = attr.traits.filter(
          trait => !shouldExcludeTrait(trait.id, selectedTraits, collection.traitRules)
        );

        if (availableTraits.length > 0) {
          const selectedTrait = seededWeightedRandom(
            availableTraits,
            `${collection.seed}-${tokenNumber}-${attr.id}-${attempt}`,
            tokenNumber
          );

          if (selectedTrait) {
            selectedTraits.push(selectedTrait.id);
          }
        }
      }
    }

    if (isValidTraitCombination(selectedTraits, collection.traitRules)) {
      return {
        tokenNumber,
        traitIds: selectedTraits,
      };
    }
  }

  console.warn(`Could not generate valid trait combination for token ${tokenNumber} after ${MAX_ATTEMPTS} attempts`);
  return null;
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
  const metadata: TokenMetadata = {
    name: `${collection.name} #${collection.startAtZero ? 0 : 1}`,
    description: collection.description || '',
    attributes: [],
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