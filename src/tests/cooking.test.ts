import { describe, expect, it } from "vitest";
import { CookingSystem, getRecipeLuxuryTier, getStarterPantry, hydratePantry, maxRecipeUpgradeLevel, maxActiveRecipesPerCategory } from "../systems/CookingSystem";
import { recipes } from "../data/recipes";
import type { LuxuryTier, SaveGameState } from "../components/types";

describe("CookingSystem menu", () => {
  it("normalizeMenuRecipeIds keeps at most 3 active recipes per category", () => {
    const cooking = new CookingSystem();
    const mains = recipes.filter((item) => item.category === "main").slice(0, 5);
    expect(mains.length).toBeGreaterThan(maxActiveRecipesPerCategory);
    const normalized = cooking.normalizeMenuRecipeIds(mains.map((item) => item.id), 5 as LuxuryTier);
    expect(normalized).toHaveLength(maxActiveRecipesPerCategory);
  });

  it("normalizeMenuRecipeIds drops locked or unknown recipes", () => {
    const cooking = new CookingSystem();
    const highTier = recipes.find((item) => getRecipeLuxuryTier(item) >= 3)!;
    expect(cooking.normalizeMenuRecipeIds([highTier.id, "not-a-real-recipe", "toast"], 1 as LuxuryTier)).toEqual([
      "toast",
    ]);
  });

  it("protects the last active menu item from removal", () => {
    const cooking = new CookingSystem();
    const first = recipes[0];
    cooking.hydrate({ menuRecipeIds: [first.id], unlockedRecipeIds: [first.id] } as SaveGameState, 1 as LuxuryTier);
    expect(cooking.isOnMenu(first.id)).toBe(true);
    expect(cooking.removeFromMenu(first.id)).toBe("lastItem");
  });
});

describe("CookingSystem upgrade levels", () => {
  it("clamps between 1 and the max", () => {
    const cooking = new CookingSystem();
    expect(cooking.getRecipeUpgradeLevel("toast")).toBe(1);
    cooking.setRecipeUpgradeLevel("toast", 999);
    expect(cooking.getRecipeUpgradeLevel("toast")).toBe(maxRecipeUpgradeLevel);
    cooking.setRecipeUpgradeLevel("toast", -5);
    expect(cooking.getRecipeUpgradeLevel("toast")).toBe(1);
  });
});

describe("CookingSystem pantry", () => {
  it("starter pantry covers every recipe ingredient", () => {
    const starterIds = new Set(getStarterPantry().map((item) => item.id));
    const missing = new Set<string>();
    for (const recipe of recipes) {
      for (const ingredient of recipe.ingredients) {
        if (!starterIds.has(ingredient)) {
          missing.add(ingredient);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });

  it("consume/has track ingredient quantities", () => {
    const cooking = new CookingSystem();
    cooking.hydrate({ menuRecipeIds: ["toast"], ingredients: getStarterPantry() } as SaveGameState, 1 as LuxuryTier);
    const toast = recipes.find((item) => item.id === "toast")!;
    expect(cooking.hasIngredients(toast)).toBe(true);
    const breadBefore = cooking.getIngredientQuantity("bread");
    cooking.consumeIngredients(toast);
    expect(cooking.getIngredientQuantity("bread")).toBe(breadBefore - toast.ingredients.filter((i) => i === "bread").length);
    cooking.addPantryStock("bread", 10);
    expect(cooking.getIngredientQuantity("bread")).toBe(breadBefore - 1 + 10);
  });

  it("prepared servings store and consume per recipe", () => {
    const cooking = new CookingSystem();
    cooking.storePreparedServing("soup");
    cooking.storePreparedServing("soup");
    expect(cooking.getPreparedServingCount("soup")).toBe(2);
    expect(cooking.consumePreparedServing("soup")).toBe(true);
    expect(cooking.getPreparedServingCount("soup")).toBe(1);
    expect(cooking.consumePreparedServing("cake")).toBe(false);
  });

  it("hydratePantry keeps saved quantities and drops unknown ingredients", () => {
    const pantry = hydratePantry([{ id: "bread", name: "Bread", quantity: 99 }]);
    expect(pantry.find((item) => item.id === "bread")?.quantity).toBe(99);
    expect(pantry.find((item) => item.id === "butter")?.quantity).toBeDefined();
  });
});

describe("recipe data integrity (plan §79)", () => {
  it("recipe ids are unique", () => {
    const ids = recipes.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("recipes have positive price, cook time, and at least one ingredient", () => {
    for (const item of recipes) {
      expect(item.sellPrice).toBeGreaterThan(0);
      expect(item.preparationTimeSeconds).toBeGreaterThan(0);
      expect(item.ingredients.length).toBeGreaterThan(0);
    }
  });

  it("auto-ranked tiers are within 1..5", () => {
    for (const item of recipes) {
      const tier = getRecipeLuxuryTier(item);
      expect(tier).toBeGreaterThanOrEqual(1);
      expect(tier).toBeLessThanOrEqual(5);
    }
  });
});
