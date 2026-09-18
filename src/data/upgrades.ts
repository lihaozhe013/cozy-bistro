/**
 * Data-driven upgrade definitions (master_plan §25–§26).
 *
 * All operational upgrades are declarative: cost curves live here (plan §27),
 * effects are compiled into a single UpgradeEffects bundle consumed by both
 * the Phaser scene and the headless simulation. Per-recipe value upgrades
 * are a separate, pre-existing system (CookingSystem recipe levels).
 */

export type UpgradeTarget =
  | "chef-cook-speed"
  | "waiter-move-speed"
  | "waiter-carry-capacity"
  | "customer-flow"
  | "guest-patience"
  | "tip-chance"
  | "tip-amount"
  | "dish-satisfaction"
  | "dishwasher-speed"
  | "marketing-glow";

export interface UpgradeDefinition {
  id: UpgradeTarget;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  /** Exponential cost growth (plan §27: 1.5–1.9). */
  growthRate: number;
  /** Linear per-level effect; interpretation depends on the target. */
  perLevel: number;
}

export const upgradeDefinitions: UpgradeDefinition[] = [
  {
    id: "chef-cook-speed",
    name: "Chef Training",
    description: "Chefs finish dishes faster.",
    maxLevel: 8,
    baseCost: 120,
    growthRate: 1.62,
    perLevel: 0.08,
  },
  {
    id: "waiter-move-speed",
    name: "Queue Trainers",
    description: "Staff walk between stations faster.",
    maxLevel: 8,
    baseCost: 100,
    growthRate: 1.6,
    perLevel: 0.08,
  },
  {
    id: "waiter-carry-capacity",
    name: "Serving Trays",
    description: "One waiter trip can deliver more plates.",
    maxLevel: 3,
    baseCost: 400,
    growthRate: 1.9,
    perLevel: 1,
  },
  {
    id: "customer-flow",
    name: "Street Charm",
    description: "More guests want a table.",
    maxLevel: 6,
    baseCost: 150,
    growthRate: 1.7,
    perLevel: 0.1,
  },
  {
    id: "guest-patience",
    name: "Comfy Waiting",
    description: "Guests tolerate longer waits before leaving.",
    maxLevel: 5,
    baseCost: 90,
    growthRate: 1.55,
    perLevel: 10,
  },
  {
    id: "tip-chance",
    name: "Warm Smiles",
    description: "Higher chance a bill comes with a tip.",
    maxLevel: 5,
    baseCost: 130,
    growthRate: 1.6,
    perLevel: 0.04,
  },
  {
    id: "tip-amount",
    name: "Signature Touch",
    description: "Tips are worth a larger share of the bill.",
    maxLevel: 5,
    baseCost: 140,
    growthRate: 1.6,
    perLevel: 0.1,
  },
  {
    id: "dish-satisfaction",
    name: "Plating School",
    description: "Dishes feel more impressive, lifting ratings.",
    maxLevel: 6,
    baseCost: 160,
    growthRate: 1.65,
    perLevel: 1,
  },
  {
    id: "dishwasher-speed",
    name: "Sink Workflow",
    description: "Dishes clear the washing station faster.",
    maxLevel: 5,
    baseCost: 110,
    growthRate: 1.58,
    perLevel: 0.12,
  },
  {
    id: "marketing-glow",
    name: "Window Display",
    description: "Raises attractiveness for customer pull.",
    maxLevel: 5,
    baseCost: 150,
    growthRate: 1.6,
    perLevel: 0.1,
  },
];

export const upgradesById: ReadonlyMap<UpgradeTarget, UpgradeDefinition> = new Map(
  upgradeDefinitions.map((definition) => [definition.id, definition]),
);

export function getUpgradeDefinition(id: UpgradeTarget): UpgradeDefinition {
  const definition = upgradesById.get(id);
  if (!definition) {
    throw new Error(`Unknown upgrade id: ${id}`);
  }
  return definition;
}

/** Cost to go from `level` to `level + 1` (exponential, plan §27). */
export function getUpgradeCost(id: UpgradeTarget, level: number): number {
  const definition = getUpgradeDefinition(id);
  if (level >= definition.maxLevel) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(1, Math.round(definition.baseCost * definition.growthRate ** level));
}

export interface UpgradeEffects {
  /** Cook durations are divided by this. */
  chefCookMultiplier: number;
  /** Staff walk durations are divided by this. */
  waiterSpeedMultiplier: number;
  /** Plates one waiter carries per delivery trip. */
  waiterCarryCapacity: number;
  /** Customer spawn rate is multiplied by this. */
  spawnRateMultiplier: number;
  /** Extra patience seconds while waiting. */
  patienceBonusSeconds: number;
  /** Chance a paid bill includes a tip. */
  tipChance: number;
  /** Tip size as a fraction of the bill. */
  tipMultiplier: number;
  /** Added to a dish's satisfaction effect for ratings. */
  satisfactionBonus: number;
  /** Dishwashing durations are divided by this. */
  dishwasherSpeedMultiplier: number;
  /** Added on top of the computed attractiveness score. */
  attractivenessBonus: number;
}

export const defaultUpgradeEffects: UpgradeEffects = {
  chefCookMultiplier: 1,
  waiterSpeedMultiplier: 1,
  waiterCarryCapacity: 1,
  spawnRateMultiplier: 1,
  patienceBonusSeconds: 0,
  tipChance: 0,
  tipMultiplier: 0,
  satisfactionBonus: 0,
  dishwasherSpeedMultiplier: 1,
  attractivenessBonus: 0,
};

/** Compile a level map into concrete runtime effects (plan §25 apply()). */
export function computeUpgradeEffects(levels: Readonly<Record<string, number>>): UpgradeEffects {
  const level = (id: UpgradeTarget) => Math.max(0, Math.floor(levels[id] ?? 0));
  return {
    chefCookMultiplier: 1 + getUpgradeDefinition("chef-cook-speed").perLevel * level("chef-cook-speed"),
    waiterSpeedMultiplier: 1 + getUpgradeDefinition("waiter-move-speed").perLevel * level("waiter-move-speed"),
    waiterCarryCapacity: 1 + getUpgradeDefinition("waiter-carry-capacity").perLevel * level("waiter-carry-capacity"),
    spawnRateMultiplier: 1 + getUpgradeDefinition("customer-flow").perLevel * level("customer-flow"),
    patienceBonusSeconds: getUpgradeDefinition("guest-patience").perLevel * level("guest-patience"),
    tipChance: Math.min(0.9, getUpgradeDefinition("tip-chance").perLevel * level("tip-chance")),
    tipMultiplier: getUpgradeDefinition("tip-amount").perLevel * level("tip-amount"),
    satisfactionBonus: getUpgradeDefinition("dish-satisfaction").perLevel * level("dish-satisfaction"),
    dishwasherSpeedMultiplier: 1 + getUpgradeDefinition("dishwasher-speed").perLevel * level("dishwasher-speed"),
    attractivenessBonus: getUpgradeDefinition("marketing-glow").perLevel * level("marketing-glow"),
  };
}

/** Human-readable "current -> next" summary for the upgrade UI (plan §35). */
export function describeUpgradeEffect(id: UpgradeTarget, level: number): string {
  const next = level + 1;
  switch (id) {
    case "chef-cook-speed":
      return `cook speed x${(1 + 0.08 * level).toFixed(2)} -> x${(1 + 0.08 * next).toFixed(2)}`;
    case "waiter-move-speed":
      return `walk speed x${(1 + 0.08 * level).toFixed(2)} -> x${(1 + 0.08 * next).toFixed(2)}`;
    case "waiter-carry-capacity":
      return `plates per trip ${1 + level} -> ${1 + next}`;
    case "customer-flow":
      return `guest flow x${(1 + 0.1 * level).toFixed(1)} -> x${(1 + 0.1 * next).toFixed(1)}`;
    case "guest-patience":
      return `+${level * 10}s patience -> +${next * 10}s`;
    case "tip-chance":
      return `${Math.round(level * 4)}% tips -> ${Math.round(next * 4)}%`;
    case "tip-amount":
      return `+${level * 10}% bill tips -> +${next * 10}%`;
    case "dish-satisfaction":
      return `+${level} dish satisfaction -> +${next}`;
    case "dishwasher-speed":
      return `wash speed x${(1 + 0.12 * level).toFixed(2)} -> x${(1 + 0.12 * next).toFixed(2)}`;
    case "marketing-glow":
      return `+${(level * 0.1).toFixed(1)} attractiveness -> +${(next * 0.1).toFixed(1)}`;
  }
}
