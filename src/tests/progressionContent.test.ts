import { describe, expect, it } from "vitest";
import {
  canPurchaseExpansion,
  expansionCost,
  expansionRequiredForTier,
  findExpansionOverlaps,
  getExpansionDefinition,
  luxuryTierForExpansion,
  nextPurchasableExpansion,
} from "../simulation/progression/Expansion";
import { expansionDefinitions } from "../data/expansions";
import { customerArchetypes, getCustomerArchetype } from "../data/customers";
import { CustomerSystem } from "../systems/CustomerSystem";
import { SeededRandom } from "../simulation/Random";
import { recipes } from "../data/recipes";
import { validateContent } from "../data/contentValidation";
import type { RecipeDefinition } from "../components/types";

const menu: RecipeDefinition[] = recipes.filter((recipe) => (recipe.luxuryTier ?? 1) <= 2);

describe("expansion progression (M5, plan §28)", () => {
  it("has at least 3 purchaseable areas with unique sign positions", () => {
    expect(expansionDefinitions.length).toBeGreaterThanOrEqual(3);
    const levels = expansionDefinitions.map((definition) => definition.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(levels[0]).toBe(1);
    const signs = new Set(expansionDefinitions.map((definition) => `${definition.signPosition.x},${definition.signPosition.y}`));
    expect(signs.size).toBe(expansionDefinitions.length);
  });

  it("areas never overlap the starter room or each other", () => {
    expect(findExpansionOverlaps()).toEqual([]);
  });

  it("cost grows exponentially and stays finite up to the max level", () => {
    let previous = 0;
    for (let level = 1; level <= expansionDefinitions.length; level += 1) {
      const cost = expansionCost(level, 5000, 2);
      expect(cost).toBeGreaterThan(previous);
      previous = cost;
    }
    expect(expansionCost(2, 1000, 1)).toBe(1000);
    expect(expansionCost(4, 1500, 1.7)).toBe(Math.round(1500 * 1.7 ** 3));
  });

  it("purchasing is strictly sequential", () => {
    expect(canPurchaseExpansion(1, 0)).toBe(true);
    expect(canPurchaseExpansion(3, 0)).toBe(false);
    expect(canPurchaseExpansion(2, 1)).toBe(true);
    expect(nextPurchasableExpansion(0)).toBe(1);
    expect(nextPurchasableExpansion(expansionDefinitions.length)).toBeNull();
    expect(getExpansionDefinition(999)).toBeUndefined();
  });

  it("luxury tier unlock mapping covers 1..5", () => {
    expect(luxuryTierForExpansion(0)).toBe(1);
    expect(luxuryTierForExpansion(4)).toBe(5);
    expect(luxuryTierForExpansion(99)).toBe(5);
    expect(expansionRequiredForTier(1)).toBe(0);
    expect(expansionRequiredForTier(5)).toBe(4);
  });
});

describe("customer archetypes (M6, plan §14)", () => {
  it("ships exactly the three planned types with sane modifiers", () => {
    expect(customerArchetypes.map((archetype) => archetype.id)).toEqual(["regular", "foodie", "family"]);
    for (const archetype of customerArchetypes) {
      expect(archetype.weight).toBeGreaterThan(0);
      expect(archetype.patienceMultiplier).toBeGreaterThan(0);
      expect(archetype.eatingTimeMultiplier).toBeGreaterThan(0);
      expect(archetype.orderValueMultiplier).toBeGreaterThanOrEqual(1);
      expect(archetype.minOrderItems).toBeLessThanOrEqual(archetype.maxOrderItems);
    }
    // Readable differentiation, not statistical noise:
    expect(getCustomerArchetype("foodie").eatingTimeMultiplier).toBeGreaterThan(1);
    expect(getCustomerArchetype("foodie").patienceMultiplier).toBeLessThan(1);
    expect(getCustomerArchetype("family").maxOrderItems).toBeGreaterThan(2);
    expect(getCustomerArchetype("family").patienceMultiplier).toBeGreaterThan(1);
  });

  it("archetype roll respects weights", () => {
    const customers = new CustomerSystem(new SeededRandom(4));
    const counts = { regular: 0, foodie: 0, family: 0 };
    const rolls = 3000;
    for (let i = 0; i < rolls; i += 1) {
      counts[customers.rollCustomerArchetype().id] += 1;
    }
    expect(counts.regular).toBeGreaterThan(counts.foodie);
    expect(counts.foodie).toBeGreaterThan(counts.family);
    expect(counts.family).toBeGreaterThan(0);
  });

  it("families order more dishes than regulars on average", () => {
    const customers = new CustomerSystem(new SeededRandom(8));
    const regular = getCustomerArchetype("regular");
    const family = getCustomerArchetype("family");
    const averageSize = (id: (typeof customerArchetypes)[number]["id"]) => {
      let total = 0;
      for (let i = 0; i < 300; i += 1) {
        const order = customers.composeArchetypeOrder(getCustomerArchetype(id), menu, 5);
        total += order.length;
        expect(order.length).toBeGreaterThanOrEqual(Math.min(getCustomerArchetype(id).minOrderItems, menu.length));
        expect(order.length).toBeLessThanOrEqual(Math.min(getCustomerArchetype(id).maxOrderItems, menu.length));
      }
      return total / 300;
    };
    expect(averageSize(family.id)).toBeGreaterThan(averageSize(regular.id));
  });

  it("dish choices stay distinct", () => {
    const customers = new CustomerSystem(new SeededRandom(2));
    for (let i = 0; i < 200; i += 1) {
      const order = customers.composeArchetypeOrder(getCustomerArchetype("family"), menu, 6);
      expect(new Set(order.map((item) => item.id)).size).toBe(order.length);
    }
  });
});

describe("content validation covers new systems (plan §79)", () => {
  it("no content errors at startup", () => {
    const issues = validateContent();
    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });
});
