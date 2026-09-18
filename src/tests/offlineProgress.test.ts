import { describe, expect, it } from "vitest";
import { computeOfflineProgress, offlineRating, type OfflineRecipeSlice, type OfflineSnapshot } from "../simulation/progression/OfflineProgress";
import { offlineCapSeconds, offlineMaxServedGuests } from "../data/balance";

const menu: OfflineRecipeSlice[] = [
  { id: "toast", sellPrice: 18, ingredientCounts: { bread: 1, butter: 1 } },
  { id: "soup", sellPrice: 26, ingredientCounts: { stock: 1, vegetables: 1 } },
];

function snapshot(overrides: Partial<OfflineSnapshot> = {}): OfflineSnapshot {
  return {
    restaurantOpen: true,
    capacityDishesPerMinute: 2,
    demandDishesPerMinute: 2,
    chefOutputDishesPerMinute: 4,
    waiterOutputDishesPerMinute: 4,
    recipes: menu,
    pantry: { bread: 1000, butter: 1000, stock: 1000, vegetables: 1000 },
    shoppingPerMinute: 0,
    ...overrides,
  };
}

const minute = 60_000;
const savedAt = 1_758_000_000_000; // non-zero epoch: 0 is the "no save" sentinel
const hour = 60 * minute;

describe("offline progress (M9)", () => {
  it("is deterministic: identical inputs give identical rewards", () => {
    const first = computeOfflineProgress(savedAt, savedAt + 5 * hour, snapshot());
    const second = computeOfflineProgress(savedAt, savedAt + 5 * hour, snapshot());
    expect(first).toEqual(second);
  });

  it("closing the game and moving the test clock scales the reward (M9 acceptance)", () => {
    const short = computeOfflineProgress(savedAt, savedAt + 30 * minute, snapshot());
    const long = computeOfflineProgress(savedAt, savedAt + 5 * hour, snapshot());
    expect(short.kind).toBe("served");
    expect(long.kind).toBe("served");
    if (short.kind !== "served" || long.kind !== "served") {
      return;
    }

    expect(short.served).toBe(60);
    expect(long.served).toBe(600 > offlineMaxServedGuests ? offlineMaxServedGuests : 600);
    expect(long.revenue).toBeGreaterThan(short.revenue * 5);

    // Doubling away-time (within cap) exactly doubles served guests.
    const doubled = computeOfflineProgress(savedAt, savedAt + 60 * minute, snapshot());
    expect(doubled.kind === "served" && doubled.served).toBe(short.served * 2);
  });

  it("caps counted time at the configured offline cap", () => {
    const outcome = computeOfflineProgress(savedAt, savedAt + 12 * hour, snapshot());
    expect(outcome.kind).toBe("served");
    if (outcome.kind !== "served") {
      return;
    }
    expect(outcome.cappedSeconds).toBe(offlineCapSeconds);
    expect(outcome.served).toBeLessThanOrEqual(offlineMaxServedGuests);
    expect(outcome.elapsedSeconds).toBe(12 * 3600);
  });

  it("ignores away-times below the reporting threshold", () => {
    expect(computeOfflineProgress(savedAt, savedAt + 30_000, snapshot())).toEqual({ kind: "too-short", elapsedSeconds: 30 });
    expect(computeOfflineProgress(0, 0, snapshot()).kind).toBe("too-short");
  });

  it("closed restaurant serves nobody but still banks shopping budget", () => {
    const outcome = computeOfflineProgress(savedAt, savedAt + 2 * hour, snapshot({ restaurantOpen: false, shoppingPerMinute: 5 }));
    expect(outcome).toEqual({ kind: "closed", elapsedSeconds: 2 * 3600, cappedSeconds: 2 * 3600, shoppingItems: 600 });
  });

  it("no menu or zero capacity yields a no-service outcome", () => {
    expect(computeOfflineProgress(savedAt, savedAt + hour, snapshot({ recipes: [] })).kind).toBe("no-service");
    expect(computeOfflineProgress(savedAt, savedAt + hour, snapshot({ capacityDishesPerMinute: 0 })).kind).toBe("no-service");
  });

  it("stops serving when the pantry runs out and never overdraws it", () => {
    const outcome = computeOfflineProgress(savedAt, savedAt + 4 * hour, snapshot({ pantry: { bread: 3, butter: 3, stock: 3, vegetables: 3 } }));
    expect(outcome.kind).toBe("served");
    if (outcome.kind !== "served") {
      return;
    }
    // Pantry covers 6 dishes (3 of each recipe pair) before toast fails.
    expect(outcome.served).toBe(6);
    for (const [ingredientId, used] of Object.entries(outcome.ingredientsUsed)) {
      expect(used).toBeLessThanOrEqual(3);
      void ingredientId;
    }
  });

  it("rating tiers follow the capacity/demand/bottleneck rules", () => {
    expect(offlineRating(10, 10, 12, 12)).toBe(5);
    expect(offlineRating(8, 10, 8, 12)).toBe(4);
    expect(offlineRating(5, 10, 5, 12)).toBe(3);
    expect(offlineRating(2, 10, 12, 2)).toBe(2);
    // Capacity-limited but neither station output is the visible bottleneck.
    expect(offlineRating(7, 10, 12, 12)).toBe(4);
  });
});
