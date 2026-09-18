/**
 * Pure offline-progress estimate for the persistence contract in SPEC.md.
 *
 * All arithmetic that turns "time away" into rewards lives here: the 8h cap,
 * served-guest cycling, pantry limits, shopping budget and service rating.
 * `Date.now()`/systems stay in the scene so tests can move the clock and get
 * deterministic, reproducible rewards (M9 acceptance).
 */

import { offlineCapSeconds, offlineMaxServedGuests, offlineMinElapsedSeconds } from "../../data/balance";

export interface OfflineRecipeSlice {
  id: string;
  /** Realized sale price including menu rank bonuses (scene-computed). */
  sellPrice: number;
  /** Ingredient id -> units consumed per cook. */
  ingredientCounts: Record<string, number>;
}

export interface OfflineSnapshot {
  restaurantOpen: boolean;
  /** Dishes the floor can actually push out per minute (min of demand/kitchen/service). */
  capacityDishesPerMinute: number;
  /** Dish demand per minute (used for rating tiers). */
  demandDishesPerMinute: number;
  chefOutputDishesPerMinute: number;
  waiterOutputDishesPerMinute: number;
  /** Active menu in cycle order; empty means nothing can be served. */
  recipes: OfflineRecipeSlice[];
  /** Pantry stock by ingredient id (not mutated; copy consumed against). */
  pantry: Record<string, number>;
  /** Ingredients per minute the errand crew restocks; 0 when auto-shop is off or no errand staff. */
  shoppingPerMinute: number;
}

export type OfflineOutcome =
  | { kind: "too-short"; elapsedSeconds: number }
  | { kind: "closed"; elapsedSeconds: number; cappedSeconds: number; shoppingItems: number }
  | { kind: "no-service"; elapsedSeconds: number; cappedSeconds: number; shoppingItems: number }
  | {
      kind: "served";
      elapsedSeconds: number;
      cappedSeconds: number;
      /** Attempts allowed by capacity/time before pantry ran dry. */
      maxServedGuests: number;
      served: number;
      revenue: number;
      ratingScore: number;
      /** Ingredient id -> units consumed offline. */
      ingredientsUsed: Record<string, number>;
      shoppingItems: number;
    };

/** Same tiering the live game used before extraction: full coverage = 5, bottlenecks scale down. */
export function offlineRating(capacity: number, demand: number, chefOutput: number, waiterOutput: number): number {
  if (capacity >= demand) {
    return 5;
  }
  if (chefOutput < demand || waiterOutput < demand) {
    return capacity >= demand * 0.75 ? 4 : capacity >= demand * 0.5 ? 3 : 2;
  }
  return 4;
}

function shoppingBudget(snapshot: OfflineSnapshot, offlineMinutes: number): number {
  return Math.floor(snapshot.shoppingPerMinute * offlineMinutes);
}

/**
 * Deterministic offline estimate: identical (lastSavedAt, now, snapshot) always
 * produce identical rewards, so a changed test clock alone changes the payout.
 */
export function computeOfflineProgress(lastSavedAt: number, now: number, snapshot: OfflineSnapshot): OfflineOutcome {
  const elapsedSeconds = Math.floor((now - lastSavedAt) / 1000);
  if (!lastSavedAt || elapsedSeconds < offlineMinElapsedSeconds) {
    return { kind: "too-short", elapsedSeconds };
  }

  const cappedSeconds = Math.min(elapsedSeconds, offlineCapSeconds);
  const offlineMinutes = cappedSeconds / 60;

  if (!snapshot.restaurantOpen) {
    return { kind: "closed", elapsedSeconds, cappedSeconds, shoppingItems: shoppingBudget(snapshot, offlineMinutes) };
  }

  if (snapshot.recipes.length === 0 || snapshot.capacityDishesPerMinute <= 0) {
    return { kind: "no-service", elapsedSeconds, cappedSeconds, shoppingItems: shoppingBudget(snapshot, offlineMinutes) };
  }

  const maxServedGuests = Math.min(offlineMaxServedGuests, Math.floor(snapshot.capacityDishesPerMinute * offlineMinutes));
  const pantry: Record<string, number> = { ...snapshot.pantry };
  const ingredientsUsed: Record<string, number> = {};
  let served = 0;
  let revenue = 0;

  for (let index = 0; index < maxServedGuests; index += 1) {
    const recipe = snapshot.recipes[index % snapshot.recipes.length];
    const missing = Object.entries(recipe.ingredientCounts).some(([ingredientId, count]) => (pantry[ingredientId] ?? 0) < count);
    if (missing) {
      break;
    }
    for (const [ingredientId, count] of Object.entries(recipe.ingredientCounts)) {
      pantry[ingredientId] -= count;
      ingredientsUsed[ingredientId] = (ingredientsUsed[ingredientId] ?? 0) + count;
    }
    revenue += recipe.sellPrice;
    served += 1;
  }

  return {
    kind: "served",
    elapsedSeconds,
    cappedSeconds,
    maxServedGuests,
    served,
    revenue,
    ratingScore: offlineRating(snapshot.capacityDishesPerMinute, snapshot.demandDishesPerMinute, snapshot.chefOutputDishesPerMinute, snapshot.waiterOutputDishesPerMinute),
    ingredientsUsed,
    shoppingItems: shoppingBudget(snapshot, offlineMinutes),
  };
}
