import { expansionDefinitions, starterCells, type ExpansionDefinition } from "../../data/expansions";

/**
 * Pure expansion progression rules: sequential level
 * purchases, cost curve, and the luxury-tier unlock mapping.
 */

export function getExpansionDefinition(level: number): ExpansionDefinition | undefined {
  return expansionDefinitions.find((definition) => definition.level === level);
}

/** Level the player can buy next, or null when everything is owned. */
export function nextPurchasableExpansion(currentLevel: number): number | null {
  const candidate = currentLevel + 1;
  return getExpansionDefinition(candidate) ? candidate : null;
}

export function expansionCost(level: number, firstCost: number, growthRate: number): number {
  const exponent = Math.max(0, level - 1);
  return Math.max(0, Math.round(firstCost * growthRate ** exponent));
}

/** Luxury tier unlocked at a given expansion level (tier = level + 1, capped at 5). */
export function luxuryTierForExpansion(expansionLevel: number): 1 | 2 | 3 | 4 | 5 {
  return Math.min(5, Math.max(1, expansionLevel + 1)) as 1 | 2 | 3 | 4 | 5;
}

/** Expansion level required to use a luxury tier. */
export function expansionRequiredForTier(tier: 1 | 2 | 3 | 4 | 5): number {
  return Math.max(0, tier - 1);
}

/** Purchasing is strictly sequential. */
export function canPurchaseExpansion(targetLevel: number, currentLevel: number): boolean {
  return targetLevel === currentLevel + 1 && Boolean(getExpansionDefinition(targetLevel));
}

export function expansionCellKey(position: { x: number; y: number }): string {
  return `${position.x},${position.y}`;
}

/** Sanity used by tests and startup validation: areas must not overlap the starter room or each other. */
export function findExpansionOverlaps(): string[] {
  const issues: string[] = [];
  const taken = new Map<string, string>();
  for (const cell of starterCells) {
    taken.set(expansionCellKey(cell), "starter");
  }
  for (const definition of expansionDefinitions) {
    for (const cell of definition.cells) {
      const key = expansionCellKey(cell);
      const holder = taken.get(key);
      if (holder) {
        issues.push(`expansion ${definition.level} cell ${key} overlaps ${holder}`);
      } else {
        taken.set(key, `expansion ${definition.level}`);
      }
    }
  }
  return issues;
}
