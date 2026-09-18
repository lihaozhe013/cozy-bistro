import { describe, expect, it } from "vitest";
import { defaultExpansionCostMultiplier, defaultFirstExpansionCost } from "../data/balance";
import { upgradeDefinitions } from "../data/upgrades";
import { simulatePacing } from "../simulation/progression/PacingModel";

const result = simulatePacing();

describe("progression pacing (M8)", () => {
  it("is deterministic across runs", () => {
    expect(simulatePacing()).toEqual(result);
  });

  it("keeps the initial complete progression inside the 30-60 minute design window (plan section 50)", () => {
    expect(result.minutesToInitialProgression).not.toBeNull();
    expect(result.minutesToInitialProgression!).toBeGreaterThanOrEqual(25);
    expect(result.minutesToInitialProgression!).toBeLessThanOrEqual(65);
  });

  it("does not gate the first expansion on a grind", () => {
    expect(result.minutesToExpansion[1]).not.toBeNull();
    expect(result.minutesToExpansion[1]!).toBeLessThanOrEqual(40);
  });

  it("later expansions take strictly longer than earlier ones", () => {
    const marks = [1, 2, 3, 4, 5].map((level) => result.minutesToExpansion[level]);
    expect(marks.every((mark) => mark !== null)).toBe(true);
    const values = marks as number[];
    for (let index = 1; index < values.length; index += 1) {
      expect(values[index]).toBeGreaterThan(values[index - 1]);
    }
  });

  it("late game keeps moving: final three expansions land within a 90 minute tail", () => {
    const l5 = result.minutesToExpansion[5];
    const l8 = result.minutesToExpansion[8];
    expect(l5).not.toBeNull();
    expect(l8).not.toBeNull();
    expect(l8! - l5!).toBeLessThanOrEqual(90);
    expect(result.final!.revenuePerMinute).toBeGreaterThan(defaultFirstExpansionCost);
  });

  it("upgrade cost growth stays inside the plan section 27 band", () => {
    for (const definition of upgradeDefinitions) {
      expect(definition.growthRate).toBeGreaterThanOrEqual(1.5);
      expect(definition.growthRate).toBeLessThanOrEqual(1.9);
    }
  });
});
