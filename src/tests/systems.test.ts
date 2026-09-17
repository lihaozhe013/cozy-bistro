import { describe, expect, it } from "vitest";
import { StaffSystem } from "../systems/StaffSystem";
import { DayCycleSystem, rentIntervalSeconds } from "../systems/DayCycleSystem";
import { ReputationSystem } from "../systems/ReputationSystem";
import { ManualClock } from "../simulation/GameClock";
import type { PlacedFurniture, SaveGameState } from "../components/types";

describe("StaffSystem", () => {
  it("tracks headcount and floors removal at zero", () => {
    const staff = new StaffSystem();
    expect(staff.addStaff("chef")).toBe(0);
    expect(staff.addStaff("chef")).toBe(1);
    expect(staff.getStaffCount("chef")).toBe(2);
    staff.removeStaff("chef");
    staff.removeStaff("chef");
    staff.removeStaff("chef");
    expect(staff.getStaffCount("chef")).toBe(0);
  });

  it("hire cost grows with headcount", () => {
    const staff = new StaffSystem();
    const first = staff.getStaffHireCost("chef");
    staff.addStaff("chef");
    const second = staff.getStaffHireCost("chef");
    expect(second).toBeGreaterThan(first);
    expect(first % 5).toBe(0);
  });

  it("queues firings and drains them one at a time", () => {
    const staff = new StaffSystem();
    staff.addStaff("waiter");
    staff.queueFiring("waiter");
    staff.queueFiring("waiter");
    expect(staff.getPendingFirings("waiter")).toBe(2);
    expect(staff.drainPendingFiring("waiter")).toBe(true);
    expect(staff.drainPendingFiring("waiter")).toBe(true);
    expect(staff.drainPendingFiring("waiter")).toBe(false);
  });

  it("salary tick waits for the 5s cadence and carries the fractional remainder", () => {
    const staff = new StaffSystem();
    staff.addStaff("chef");
    expect(staff.tickSalary(0, 60).charge).toBe(0);
    expect(staff.tickSalary(4000, 60).charge).toBe(0);
    // 1 staff * $60/min * 6s (4000ms -> 10000ms) = $6.
    const result = staff.tickSalary(10000, 60);
    expect(result.charge).toBe(6);
    // Sub-second accrual only bills once whole dollars pile up.
    const partial = staff.tickSalary(14000, 1);
    expect(partial.charge).toBe(0);
  });

  it("hydrate restores staff and clears pending firings", () => {
    const staff = new StaffSystem();
    staff.queueFiring("chef");
    staff.hydrate({ staff: { chefs: 3, waiters: 2, errandBoys: 1 } } as SaveGameState);
    expect(staff.getStaff()).toEqual({ chefs: 3, waiters: 2, errandBoys: 1 });
    expect(staff.getPendingFirings("chef")).toBe(0);
  });
});

describe("DayCycleSystem", () => {
  it("flags day end exactly once per rollover", () => {
    const cycle = new DayCycleSystem(1, 10);
    expect(cycle.tick(6).dayEnded).toBe(false);
    expect(cycle.tick(4).dayEnded).toBe(true);
    cycle.rollOverDay();
    expect(cycle.getDayNumber()).toBe(2);
    expect(cycle.tick(1).dayEnded).toBe(false);
  });

  it("accumulates play and rent time, and consumes whole rent periods", () => {
    const cycle = new DayCycleSystem();
    cycle.tick(100);
    expect(cycle.getTotalPlaySeconds()).toBe(100);
    expect(cycle.consumePendingRentPeriods()).toBe(0);
    cycle.tick(rentIntervalSeconds);
    expect(cycle.consumePendingRentPeriods()).toBe(1);
    // 100s of pre-existing accrual remain in the cycle after consuming one period.
    expect(cycle.getRentElapsedSeconds()).toBeCloseTo(100, 5);
  });
});

describe("ReputationSystem", () => {
  const decor: PlacedFurniture[] = [
    { uid: "a", furnitureId: "fern-planter", position: { x: 1, y: 1 } },
    { uid: "b", furnitureId: "round-table", position: { x: 2, y: 2 } },
  ];

  it("scores decoration above the baseline of an empty room", () => {
    const reputation = new ReputationSystem();
    expect(reputation.getDecorationScore([])).toBeLessThan(reputation.getDecorationScore(decor));
  });

  it("attractiveness blends decor and reputation within 0.5..5", () => {
    const reputation = new ReputationSystem(5);
    const value = reputation.getAttractiveness(decor);
    expect(value).toBeGreaterThanOrEqual(0.5);
    expect(value).toBeLessThanOrEqual(5);
  });

  it("records integer ratings 1..5 and averages them", () => {
    const reputation = new ReputationSystem();
    expect(reputation.getAverageRating()).toBe(3);
    reputation.recordRating(4.6);
    reputation.recordRating(1.2);
    reputation.recordRating(99);
    expect(reputation.getRatingHistory()).toEqual([5, 1, 5]);
    expect(reputation.getAverageRating()).toBeCloseTo((5 + 1 + 5) / 3, 5);
    expect(reputation.getRatingCount()).toBe(3);
  });

  it("caps saved rating history at the max length", () => {
    const reputation = new ReputationSystem();
    const many = Array.from({ length: 600 }, (_, i) => (i % 5) + 1);
    reputation.hydrate({ ratingHistory: many } as unknown as SaveGameState);
    expect(reputation.getRatingHistory().length).toBe(500);
  });

  it("reconstructs a legacy history from total/count without a history array", () => {
    const reputation = new ReputationSystem();
    reputation.hydrate({ ratingTotal: 18, ratingCount: 6 } as unknown as SaveGameState);
    expect(reputation.getRatingHistory()).toHaveLength(6);
    expect(reputation.getAverageRating()).toBeCloseTo(3, 5);
  });
});
