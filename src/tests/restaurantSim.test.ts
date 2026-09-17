import { describe, expect, it } from "vitest";
import { RestaurantSimulation, type SimulationConfig } from "../simulation/RestaurantSimulation";
import { EventBus } from "../simulation/EventBus";
import { SeededRandom } from "../simulation/Random";
import { TaskReservationRegistry } from "../simulation/staff/StaffTasks";
import { recipes } from "../data/recipes";
import { clamp } from "../simulation/Random";
import type { RecipeDefinition } from "../components/types";

const menu: RecipeDefinition[] = ["toast", "soup", "pasta", "lemonade"]
  .map((id) => recipes.find((recipe) => recipe.id === id))
  .filter((recipe): recipe is RecipeDefinition => Boolean(recipe));
const toast = menu[0];

interface EventTrail {
  servedOrderIds: string[];
  createdOrderIds: string[];
  readyOrderIds: string[];
  cancelledOrderIds: string[];
  paidAmounts: number[];
}

function createSim(overrides: Partial<SimulationConfig> = {}) {
  const config = {
    seatCount: 2,
    chefCount: 1,
    waiterCount: 1,
    stations: [{ id: "stove-1", slotCount: 1 }],
    menu,
    spawnIntervalMs: 2500,
    ...overrides,
  };
  const events = new EventBus();
  const trail: EventTrail = {
    servedOrderIds: [],
    createdOrderIds: [],
    readyOrderIds: [],
    cancelledOrderIds: [],
    paidAmounts: [],
  };
  events.on("order-created", ({ ticketId }) => trail.createdOrderIds.push(ticketId));
  events.on("order-ready", ({ ticketId }) => trail.readyOrderIds.push(ticketId));
  events.on("order-served", ({ ticketId }) => trail.servedOrderIds.push(ticketId));
  events.on("order-cancelled", ({ ticketId }) => trail.cancelledOrderIds.push(ticketId));
  events.on("customer-paid", ({ amount }) => trail.paidAmounts.push(amount));
  const sim = new RestaurantSimulation(config, {
    random: new SeededRandom(1234),
    events,
  });
  return { sim, trail };
}

describe("RestaurantSimulation M2 acceptance", () => {
  it("20 sequential customers all complete or safely leave without stuck state", () => {
    const { sim, trail } = createSim({ maxGuests: 20 });
    const finished = sim.runUntil(() => sim.everyoneFinished(), 30 * 60 * 1000);
    expect(finished).toBe(true);

    const snap = sim.snapshot();
    // No stuck tables / seats: after everyone leaves, cleaning drains.
    sim.runFor(60_000);
    expect(sim.snapshot().dirtySeats).toHaveLength(0);

    // No permanent staff deadlock: everyone idle at rest.
    expect(sim.snapshot().staff.every((staff) => staff.task === "idle")).toBe(true);

    // No duplicate orders: every created order was served exactly once
    // (generous patience makes abandonment impossible here).
    expect(new Set(trail.servedOrderIds).size).toBe(trail.servedOrderIds.length);
    expect(trail.servedOrderIds.length).toBe(trail.createdOrderIds.length);
    expect(sim.lost).toBe(0);

    // Money actually flowed and matches served dish prices.
    expect(sim.served).toBe(20);
    expect(sim.money).toBeGreaterThan(0);
    expect(trail.paidAmounts).toHaveLength(20);
    expect(trail.paidAmounts.reduce((sum, amount) => sum + amount, 0)).toBe(sim.money);
  });

  it("revenue covers delivered dish prices (archetype value multipliers only add)", () => {
    const { sim, trail } = createSim({ seatCount: 4, waiterCarryCapacity: 2, maxGuests: 8 });
    expect(sim.runUntil(() => sim.everyoneFinished(), 30 * 60 * 1000)).toBe(true);
    const byId = new Map(menu.map((recipe) => [recipe.id, recipe]));
    let base = 0;
    for (const orderId of trail.servedOrderIds) {
      const order = sim.orders.get(orderId);
      expect(order).toBeDefined();
      base += byId.get(order!.recipe.id)!.sellPrice;
    }
    // All archetype multipliers are >= 1, so realized revenue >= base prices.
    expect(sim.money).toBeGreaterThanOrEqual(base);
    // Every coin entered through customer payments only.
    expect(trail.paidAmounts.reduce((sum, amount) => sum + amount, 0)).toBe(sim.money);
  });

  it("impatient guests leave safely, orders cancel, and seats recover", () => {
    const { sim, trail } = createSim({
      patienceBaseMs: 1,
      patiencePerDishMs: 0,
      menu: menu.map((recipe) => ({ ...recipe, preparationTimeSeconds: 30 })),
    });
    expect(sim.runUntil(() => sim.lost >= 3, 10 * 60 * 1000)).toBe(true);
    sim.runFor(120_000);
    expect(sim.snapshot().dirtySeats).toHaveLength(0);
    expect(trail.cancelledOrderIds.length).toBeGreaterThan(0);
    // Cancelled orders never get delivered afterwards.
    for (const cancelled of trail.cancelledOrderIds) {
      expect(trail.servedOrderIds).not.toContain(cancelled);
      expect(sim.orders.get(cancelled)?.state).toBe("cancelled");
    }
  });

  it("survives a high-pressure shift with no duplicated deliveries or stuck guests", () => {
    const slowMenu = menu.map((recipe) => ({ ...recipe, preparationTimeSeconds: clamp(recipe.preparationTimeSeconds, 4, 8) }));
    const { sim, trail } = createSim({
      seatCount: 6,
      chefCount: 2,
      waiterCount: 2,
      stations: [
        { id: "stove-1", slotCount: 2 },
        { id: "counter-1", slotCount: 1 },
      ],
      menu: slowMenu,
      spawnIntervalMs: 1200,
      maxGuests: 60,
    });
    sim.runFor(15 * 60 * 1000);
    // Cap reached; drain phase lets everyone settle.
    const settled = sim.runUntil(() => sim.everyoneFinished(), 10 * 60 * 1000);
    expect(settled).toBe(true);
    expect(new Set(trail.servedOrderIds).size).toBe(trail.servedOrderIds.length);
    const allTerminal = sim.orders.all().every((order) => ["served", "completed", "cancelled"].includes(order.state));
    expect(allTerminal).toBe(true);
    expect(sim.snapshot().activeGuests).toHaveLength(0);
    expect(sim.served + sim.lost).toBe(60);
    expect(sim.spawned).toBe(60);
    expect(sim.served).toBeGreaterThan(10);
  });
});

describe("RestaurantSimulation M3 staff behaviour", () => {
  it("chef processes the oldest queued order first", () => {
    // Two stations' worth of waiting orders created before any cooking
    // finishes: the first completed dish must be the first created order.
    const slow: RecipeDefinition[] = menu.map((recipe) => ({ ...recipe, preparationTimeSeconds: 20 }));
    const { sim, trail } = createSim({
      seatCount: 2,
      maxOrdersPerGuest: 1,
      spawnIntervalMs: 1000,
      menu: slow,
      patienceBaseMs: 300_000,
    });
    sim.runUntil(() => trail.createdOrderIds.length >= 2, 60_000);
    const first = trail.createdOrderIds[0];
    expect(sim.runUntil(() => trail.readyOrderIds.length >= 1, 120_000)).toBe(true);
    expect(trail.readyOrderIds[0]).toBe(first);
  });

  it("waiter speed upgrades increase throughput with identical seeds", () => {
    const runThroughput = (multiplier: number) => {
      const events = new EventBus();
      let served = 0;
      events.on("order-served", () => {
        served += 1;
      });
      const sim = new RestaurantSimulation(
        {
          seatCount: 4,
          chefCount: 1,
          waiterCount: 1,
          stations: [{ id: "stove-1", slotCount: 2 }],
          menu,
          spawnIntervalMs: 2000,
          waiterSpeedMultiplier: multiplier,
        },
        { random: new SeededRandom(77), events },
      );
      sim.runFor(8 * 60 * 1000);
      return served;
    };
    expect(runThroughput(2)).toBeGreaterThan(runThroughput(1));
  });

  it("carry capacity lets a waiter batch multiple dishes per trip", () => {
    // One chef cooks three quick dishes sequentially while the waiter is on
    // its first delivery; by the time it returns, two dishes are ready.
    // carry 2 serves them on one trip (one leg apart); carry 1 must make two
    // separate counter round trips.
    const fastMenu = menu.map((recipe) => ({ ...recipe, preparationTimeSeconds: 1 }));
    const serveGaps = (carry: number) => {
      const events = new EventBus();
      const stamps: number[] = [];
      events.on("order-served", () => stamps.push(-1));
      const sim = new RestaurantSimulation(
        {
          seatCount: 4,
          chefCount: 1,
          waiterCount: 1,
          stations: [{ id: "stove-1", slotCount: 2 }],
          menu: fastMenu,
          spawnIntervalMs: 100,
          maxOrdersPerGuest: 1,
          waiterCarryCapacity: carry,
          maxGuests: 3,
          patienceBaseMs: 300_000,
        },
        { random: new SeededRandom(9), events },
      );
      let last = 0;
      while (sim.timeMs < 60_000 && stamps.length < 3) {
        sim.step(50);
        while (stamps[last] === -1) {
          stamps[last] = sim.timeMs;
          last += 1;
        }
      }
      expect(stamps.filter((stamp) => stamp >= 0).length).toBe(3);
      const times = stamps.filter((stamp) => stamp >= 0);
      return [times[1] - times[0], times[2] - times[1]];
    };
    const batched = serveGaps(2);
    const solo = serveGaps(1);
    // leg (900) + handoff (300) = 1200ms for a batched follow-up serve.
    expect(Math.min(...batched)).toBeLessThanOrEqual(1300);
    // A solo second trip must walk back to the counter first (>= 2100ms).
    expect(Math.min(...solo)).toBeGreaterThanOrEqual(2000);
  });

  it("two waiters never serve the same order", () => {
    const { sim, trail } = createSim({
      seatCount: 6,
      waiterCount: 2,
      spawnIntervalMs: 1500,
    });
    sim.runFor(6 * 60 * 1000);
    expect(trail.servedOrderIds.length).toBeGreaterThan(0);
    expect(new Set(trail.servedOrderIds).size).toBe(trail.servedOrderIds.length);
  });

  it("table-payment mode routes payment through waiters", () => {
    const { sim } = createSim({
      collectPaymentsAtTable: true,
      seatCount: 2,
      spawnIntervalMs: 2000,
    });
    expect(sim.runUntil(() => sim.served >= 4, 10 * 60 * 1000)).toBe(true);
    expect(sim.money).toBeGreaterThan(0);
  });
});

describe("TaskReservationRegistry", () => {
  it("prevents duplicate claims and supports releases", () => {
    const registry = new TaskReservationRegistry();
    const target = { type: "order" as const, id: "o1" };
    expect(registry.reserve("waiter-0", target)).toBe(true);
    expect(registry.reserve("waiter-0", target)).toBe(true);
    expect(registry.reserve("waiter-1", target)).toBe(false);
    registry.release("waiter-0", target);
    expect(registry.reserve("waiter-1", target)).toBe(true);
    expect(registry.count()).toBe(1);
  });

  it("releaseAllFor frees everything a staff member holds", () => {
    const registry = new TaskReservationRegistry();
    registry.reserve("chef-0", { type: "order", id: "a" });
    registry.reserve("chef-0", { type: "order", id: "b" });
    registry.reserve("chef-1", { type: "order", id: "c" });
    const released = registry.releaseAllFor("chef-0");
    expect(released.sort()).toEqual(["order:a", "order:b"]);
    expect(registry.count()).toBe(1);
  });

  it("prune drops reservations whose targets no longer exist", () => {
    const registry = new TaskReservationRegistry();
    registry.reserve("w", { type: "seat", id: "1" });
    registry.reserve("w", { type: "seat", id: "2" });
    registry.prune(new Set(["seat:1"]));
    expect(registry.isReserved({ type: "seat", id: "1" })).toBe(true);
    expect(registry.isReserved({ type: "seat", id: "2" })).toBe(false);
  });
});
