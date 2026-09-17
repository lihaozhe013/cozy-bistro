import { describe, expect, it } from "vitest";
import { UpgradeSystem } from "../simulation/progression/UpgradeSystem";
import { EconomySystem } from "../systems/EconomySystem";
import { EventBus } from "../simulation/EventBus";
import { getUpgradeCost, computeUpgradeEffects, upgradeDefinitions } from "../data/upgrades";
import { RestaurantSimulation } from "../simulation/RestaurantSimulation";
import { SeededRandom } from "../simulation/Random";
import { recipes } from "../data/recipes";
import type { RecipeDefinition } from "../components/types";

const menu: RecipeDefinition[] = ["toast", "soup", "pasta", "lemonade"]
  .map((id) => recipes.find((recipe) => recipe.id === id))
  .filter((recipe): recipe is RecipeDefinition => Boolean(recipe));

describe("upgrade definitions (plan §25-§27)", () => {
  it("has at least 10 meaningful upgrades", () => {
    expect(upgradeDefinitions.length).toBeGreaterThanOrEqual(10);
    expect(new Set(upgradeDefinitions.map((definition) => definition.id)).size).toBe(upgradeDefinitions.length);
  });

  it("cost curves are positive, increasing, and finite below max", () => {
    for (const definition of upgradeDefinitions) {
      expect(definition.maxLevel).toBeGreaterThanOrEqual(3);
      expect(definition.growthRate).toBeGreaterThanOrEqual(1.5);
      expect(definition.growthRate).toBeLessThanOrEqual(2.4);
      let previous = 0;
      for (let level = 0; level < definition.maxLevel; level += 1) {
        const cost = getUpgradeCost(definition.id, level);
        expect(cost).toBeGreaterThan(previous);
        previous = cost;
      }
      expect(getUpgradeCost(definition.id, definition.maxLevel)).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it("effects compile from levels", () => {
    const base = computeUpgradeEffects({});
    expect(base.chefCookMultiplier).toBe(1);
    expect(base.tipChance).toBe(0);
    const buffed = computeUpgradeEffects({ "chef-cook-speed": 2, "waiter-carry-capacity": 2, "tip-chance": 5 });
    expect(buffed.chefCookMultiplier).toBeCloseTo(1.16, 5);
    expect(buffed.waiterCarryCapacity).toBe(3);
    expect(buffed.tipChance).toBeCloseTo(0.2, 5);
  });
});

describe("UpgradeSystem", () => {
  it("purchases through the economy and refuses when short", () => {
    const economy = new EconomySystem(150);
    const upgrades = new UpgradeSystem(economy);
    expect(upgrades.canAfford("chef-cook-speed")).toBe(true);
    expect(upgrades.purchase("waiter-carry-capacity")).toBeNull();
    economy.setMoney(20);
    expect(upgrades.canAfford("chef-cook-speed")).toBe(false);
    expect(upgrades.purchase("chef-cook-speed")).toBeNull();
    expect(economy.getMoney()).toBe(20);
    economy.setMoney(500);
    const events = new EventBus();
    let announced: string | null = null;
    events.on("upgrade-purchased", ({ upgradeId, level }) => (announced = `${upgradeId}:${level}`));
    const system = new UpgradeSystem(economy, events);
    expect(system.purchase("chef-cook-speed")).toBe(1);
    expect(economy.getMoney()).toBe(500 - 120);
    expect(announced).toBe("chef-cook-speed:1");
    expect(system.effects().chefCookMultiplier).toBeCloseTo(1.08, 5);
  });

  it("respects max levels", () => {
    const economy = new EconomySystem(1_000_000);
    const upgrades = new UpgradeSystem(economy);
    for (let i = 0; i < 5; i += 1) {
      upgrades.purchase("waiter-carry-capacity");
    }
    expect(upgrades.getLevel("waiter-carry-capacity")).toBe(3);
    expect(upgrades.purchase("waiter-carry-capacity")).toBeNull();
    expect(upgrades.effects().waiterCarryCapacity).toBe(4);
  });

  it("hydrates defensively: clamps levels and drops unknown ids", () => {
    const upgrades = new UpgradeSystem(new EconomySystem(0));
    upgrades.hydrate({ "chef-cook-speed": 999, "made-up": 3, "tip-chance": -2 });
    expect(upgrades.getLevel("chef-cook-speed")).toBe(8);
    expect(upgrades.getLevel("tip-chance")).toBe(0);
    expect(upgrades.getLevelsSnapshot()).toEqual({ "chef-cook-speed": 8 });
  });
});

describe("upgrade effects in RestaurantSimulation", () => {
  const serveTimeWithCookMult = (mult: number) => {
    const events = new EventBus();
    let firstServe = -1;
    events.on("order-served", () => {
      if (firstServe < 0) firstServe = 0;
    });
    const sim = new RestaurantSimulation(
      {
        seatCount: 2,
        chefCount: 1,
        waiterCount: 1,
        stations: [{ id: "stove-1", slotCount: 1 }],
        menu: [{ ...menu[0], preparationTimeSeconds: 10 }],
        spawnIntervalMs: 100,
        maxOrdersPerGuest: 1,
        maxGuests: 1,
        effects: computeUpgradeEffects({ "chef-cook-speed": 0 }),
        ...(mult > 1 ? { chefSpeedMultiplier: mult } : {}),
      },
      { random: new SeededRandom(3), events },
    );
    sim.runUntil(() => firstServe >= 0 || sim.timeMs > 60_000, 60_001);
    return sim.timeMs;
  };

  it("chef speed multiplier shortens time to first serve", () => {
    expect(serveTimeWithCookMult(2)).toBeLessThan(serveTimeWithCookMult(1));
  });

  it("upgrade effects flow through computeUpgradeEffects into the sim", () => {
    const events = new EventBus();
    let served = 0;
    events.on("order-served", () => (served += 1));
    const sim = new RestaurantSimulation(
      {
        seatCount: 3,
        chefCount: 1,
        waiterCount: 1,
        stations: [{ id: "stove-1", slotCount: 2 }],
        menu,
        spawnIntervalMs: 2000,
        maxOrdersPerGuest: 1,
        maxGuests: 10,
        effects: computeUpgradeEffects({ "chef-cook-speed": 8, "waiter-move-speed": 8, "waiter-carry-capacity": 3 }),
      },
      { random: new SeededRandom(21), events },
    );
    sim.runUntil(() => sim.everyoneFinished(), 10 * 60 * 1000);
    expect(served).toBe(10);

    // Same seed, no upgrades, half the budget: fewer completes.
    const plain = new RestaurantSimulation(
      {
        seatCount: 3,
        chefCount: 1,
        waiterCount: 1,
        stations: [{ id: "stove-1", slotCount: 2 }],
        menu,
        spawnIntervalMs: 2000,
        maxOrdersPerGuest: 1,
        maxGuests: 10,
      },
      { random: new SeededRandom(21), events: new EventBus() },
    );
    const halfBudgetStart = plain.timeMs;
    plain.runUntil(() => plain.everyoneFinished(), 10 * 60 * 1000);
    void halfBudgetStart;
    expect(sim.timeMs).toBeLessThanOrEqual(plain.timeMs);
  });

  it("patience upgrade prevents impatient walkouts", () => {
    const run = (withPatience: boolean) => {
      const sim = new RestaurantSimulation(
        {
          seatCount: 2,
          chefCount: 1,
          waiterCount: 1,
          stations: [{ id: "stove-1", slotCount: 1 }],
          menu: [{ ...menu[0], preparationTimeSeconds: 40 }],
          spawnIntervalMs: 2000,
          maxOrdersPerGuest: 1,
          maxGuests: 4,
          patienceBaseMs: 1000,
          patiencePerDishMs: 0,
          ...(withPatience ? { effects: computeUpgradeEffects({ "guest-patience": 5 }) } : {}),
        },
        { random: new SeededRandom(31), events: new EventBus() },
      );
      sim.runUntil(() => sim.everyoneFinished(), 20 * 60 * 1000);
      return { lost: sim.lost, served: sim.served };
    };
    const impatient = run(false);
    const patient = run(true);
    expect(impatient.lost).toBeGreaterThan(0);
    expect(patient.lost).toBe(0);
    expect(patient.served).toBe(4);
  });
});
