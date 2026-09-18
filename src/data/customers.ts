/**
 * Customer archetypes for the gameplay contract in SPEC.md. Three readable types keep behavior
 * variety without premature complexity; the plan's MVP requires 3 variants.
 */

export type CustomerArchetypeId = "regular" | "foodie" | "family";

export interface CustomerArchetypeDefinition {
  id: CustomerArchetypeId;
  name: string;
  /** Relative spawn weight (normalized at roll time). */
  weight: number;
  /** Patience scaling; below 1 leaves earlier, above 1 waits longer. */
  patienceMultiplier: number;
  /** Eating duration scaling. */
  eatingTimeMultiplier: number;
  /** Bill scaling used by the revenue formula. */
  orderValueMultiplier: number;
  /** Range of dishes ordered per visit. */
  minOrderItems: number;
  maxOrderItems: number;
  /** Flat addition to tip chance. */
  tipChanceBonus: number;
  /** Short flavor line used by UI/tooltips. */
  description: string;
}

export const customerArchetypes: CustomerArchetypeDefinition[] = [
  {
    id: "regular",
    name: "Regular",
    weight: 60,
    patienceMultiplier: 1,
    eatingTimeMultiplier: 1,
    orderValueMultiplier: 1,
    minOrderItems: 1,
    maxOrderItems: 2,
    tipChanceBonus: 0,
    description: "Neighborhood staple. Predictable and easygoing.",
  },
  {
    id: "foodie",
    name: "Foodie",
    weight: 25,
    patienceMultiplier: 0.85,
    eatingTimeMultiplier: 1.35,
    orderValueMultiplier: 1.25,
    minOrderItems: 2,
    maxOrderItems: 3,
    tipChanceBonus: 0.1,
    description: "Savors every course and pays for quality, but hates waiting.",
  },
  {
    id: "family",
    name: "Family",
    weight: 15,
    patienceMultiplier: 1.2,
    eatingTimeMultiplier: 1,
    orderValueMultiplier: 1.15,
    minOrderItems: 2,
    maxOrderItems: 4,
    tipChanceBonus: 0.05,
    description: "A full table order, patient while the kitchen catches up.",
  },
];

export const customerArchetypesById: ReadonlyMap<CustomerArchetypeId, CustomerArchetypeDefinition> = new Map(
  customerArchetypes.map((archetype) => [archetype.id, archetype]),
);

export function getCustomerArchetype(id: CustomerArchetypeId): CustomerArchetypeDefinition {
  const archetype = customerArchetypesById.get(id);
  if (!archetype) {
    throw new Error(`Unknown customer archetype: ${id}`);
  }
  return archetype;
}
