import type { PlacedFurniture, RecipeDefinition, SaveGameState } from "../components/types";
import { getFurnitureDefinition } from "../data/furniture";
import { between, clamp, defaultRandomSource, pick, type RandomSource } from "../simulation/Random";
import {
  customerArchetypes,
  getCustomerArchetype,
  type CustomerArchetypeDefinition,
  type CustomerArchetypeId,
} from "../data/customers";

/** What category of dish a customer arrived hoping to eat. */
export interface CustomerExpectation {
  category: RecipeDefinition["category"];
}

/**
 * Owns customer-flow data and the random decisions a customer makes on arrival.
 *
 * Phaser-coupled lifecycle (sprites, container, pathing) still lives in the scene.
 * Seat quality is passed in as a number rather than a seat object so this module
 * doesn't depend on the placement/furniture systems.
 */
export class CustomerSystem {
  private dailyServed = 0;
  private dailyLost = 0;
  private readonly random: RandomSource;

  constructor(random: RandomSource = defaultRandomSource()) {
    this.random = random;
  }

  getAvailableSeatCount(furniture: PlacedFurniture[]): number {
    return furniture
      .map((item) => getFurnitureDefinition(item.furnitureId))
      .filter((definition) => definition.category === "chair")
      .reduce((sum, definition) => sum + (definition.seatingCapacity ?? 1), 0);
  }

  estimateSpawnRate(attractiveness: number, seatCount: number, menuQuality: number, averageRating = 3): number {
    return estimateSpawnRate(attractiveness, seatCount, menuQuality, averageRating);
  }

  /** Weighted archetype roll (plan §14). */
  rollCustomerArchetype(): CustomerArchetypeDefinition {
    const totalWeight = customerArchetypes.reduce((sum, archetype) => sum + archetype.weight, 0);
    let roll = this.random.next() * totalWeight;
    for (const archetype of customerArchetypes) {
      roll -= archetype.weight;
      if (roll <= 0) {
        return archetype;
      }
    }
    return getCustomerArchetype("regular");
  }

  /** Pick dishes for a guest honoring archetype min/max order size. */
  composeArchetypeOrder(
    archetype: CustomerArchetypeDefinition,
    availableRecipes: RecipeDefinition[],
    seatQuality = 4,
    expectation?: CustomerExpectation,
  ): RecipeDefinition[] {
    const seatBias = seatQuality + (archetype.maxOrderItems - 2) * 2;
    const order = this.chooseGuestOrder(availableRecipes, seatBias, expectation);
    const min = Math.min(archetype.minOrderItems, availableRecipes.length);
    const max = Math.min(archetype.maxOrderItems, availableRecipes.length);
    let items = order;
    if (items.length > max) {
      items = items.slice(0, max);
    }
    if (items.length < min) {
      const extras = availableRecipes.filter((recipe) => !items.some((item) => item.id === recipe.id));
      items = [...items, ...extras.slice(0, min - items.length)];
    }
    return items;
  }

  /** Roll the category a newly arrived guest wants. Probabilities are tuned for variety. */
  rollCustomerExpectation(): CustomerExpectation {
    const roll = between(this.random, 1, 100);
    const category: RecipeDefinition["category"] =
      roll <= 22
        ? "drink"
        : roll <= 38
          ? "dessert"
          : roll <= 58
            ? "appetizer"
            : roll <= 86
              ? "main"
              : "side";

    return { category };
  }

  /**
   * Pick 1–4 recipes for a guest's order. Higher seatQuality biases toward bigger,
   * more main-heavy orders. If an expectation is provided, the first picked recipe
   * matches that category (or the function returns an empty array if no recipe in
   * the active menu satisfies the expectation).
   */
  chooseGuestOrder(
    availableRecipes: RecipeDefinition[],
    seatQuality = 4,
    expectation?: CustomerExpectation,
  ): RecipeDefinition[] {
    const fullCourseBias = clamp((seatQuality - 6) * 6, -18, 28);
    const roll = between(this.random, 1, 100);
    const targetCount =
      roll <= 42 - fullCourseBias
        ? 1
        : roll <= 76 - fullCourseBias * 0.5
          ? 2
          : roll <= 93 - fullCourseBias * 0.15
            ? 3
            : 4;
    const categories: RecipeDefinition["category"][] =
      targetCount === 1
        ? seatQuality < 6
          ? ["drink", "side", "appetizer", "main", "dessert"]
          : ["appetizer", "drink", "side", "main", "dessert"]
        : seatQuality >= 9
          ? ["appetizer", "main", "drink", "dessert", "side"]
          : ["main", "drink", "appetizer", "side", "dessert"];
    const order: RecipeDefinition[] = [];
    if (expectation) {
      const expectedOptions = availableRecipes.filter((recipe) => recipe.category === expectation.category);
      if (expectedOptions.length === 0) {
        return [];
      }
      order.push(pick(this.random, expectedOptions));
    }

    categories.forEach((category) => {
      if (order.length >= targetCount) {
        return;
      }

      const options = availableRecipes.filter(
        (recipe) => recipe.category === category && !order.some((item) => item.id === recipe.id),
      );
      if (options.length > 0) {
        order.push(pick(this.random, options));
      }
    });

    while (order.length < targetCount && order.length < availableRecipes.length) {
      const options = availableRecipes.filter((recipe) => !order.some((item) => item.id === recipe.id));
      order.push(pick(this.random, options));
    }

    return order.length > 0 ? order : [pick(this.random, availableRecipes)];
  }

  getDailyServed(): number {
    return this.dailyServed;
  }

  getDailyLost(): number {
    return this.dailyLost;
  }

  recordServed(count = 1): void {
    this.dailyServed += count;
  }

  recordLost(count = 1): void {
    this.dailyLost += count;
  }

  resetDailyTotals(): void {
    this.dailyServed = 0;
    this.dailyLost = 0;
  }

  /** Restore daily counters from a save snapshot. */
  hydrate(save: SaveGameState | null | undefined): void {
    this.dailyServed = save?.dailyServed ?? 0;
    this.dailyLost = save?.dailyLost ?? 0;
  }
}

/**
 * Pure form of the spawn-rate heuristic (plan §7). Exported so headless
 * tools (pacing model, offline estimates) reuse the exact live formula.
 */
export function estimateSpawnRate(attractiveness: number, seatCount: number, menuQuality: number, averageRating = 3): number {
  if (seatCount === 0) {
    return 0;
  }

  const decorPull = Math.max(0, Math.min(1, (attractiveness - 1) / 4));
  const ratingPull = Math.max(0, Math.min(1, (averageRating - 1) / 4));
  const menuPull = Math.max(0.25, Math.min(1.15, 0.25 + menuQuality * 0.08));
  const seatPull = seatCount * (0.08 + decorPull * 0.9);
  const reputationPull = 0.3 + ratingPull * 1.5;
  return Math.max(1, Math.round(seatPull * reputationPull * menuPull));
}
