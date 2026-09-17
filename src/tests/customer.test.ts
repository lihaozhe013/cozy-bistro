import { describe, expect, it } from "vitest";
import { CustomerSystem } from "../systems/CustomerSystem";
import { SeededRandom } from "../simulation/Random";
import type { RecipeDefinition, SaveGameState } from "../components/types";

const recipe = (id: string, category: RecipeDefinition["category"]): RecipeDefinition => ({
  id,
  name: id,
  category,
  ingredients: ["bread"],
  preparationTimeSeconds: 3,
  stationNeeded: "counter",
  sellPrice: 10,
  satisfactionEffect: 3,
  unlockedByDefault: true,
});

const menu: RecipeDefinition[] = [
  recipe("toast", "appetizer"),
  recipe("soup", "main"),
  recipe("salad", "main"),
  recipe("lemonade", "drink"),
  recipe("fries", "side"),
  recipe("cake", "dessert"),
];

describe("CustomerSystem", () => {
  it("is deterministic with a seeded random source", () => {
    const a = new CustomerSystem(new SeededRandom(9));
    const b = new CustomerSystem(new SeededRandom(9));
    const ordersA = Array.from({ length: 50 }, () =>
      a
        .chooseGuestOrder(menu, 5)
        .map((item) => item.id)
        .join("+"),
    );
    const ordersB = Array.from({ length: 50 }, () =>
      b
        .chooseGuestOrder(menu, 5)
        .map((item) => item.id)
        .join("+"),
    );
    expect(ordersA).toEqual(ordersB);
  });

  it("orders between 1 and 4 distinct recipes", () => {
    const customers = new CustomerSystem(new SeededRandom(11));
    for (let i = 0; i < 200; i += 1) {
      const order = customers.chooseGuestOrder(menu, 6);
      expect(order.length).toBeGreaterThanOrEqual(1);
      expect(order.length).toBeLessThanOrEqual(4);
      expect(new Set(order.map((item) => item.id)).size).toBe(order.length);
    }
  });

  it("honours the expectation category for the first dish", () => {
    const customers = new CustomerSystem(new SeededRandom(5));
    for (let i = 0; i < 100; i += 1) {
      const order = customers.chooseGuestOrder(menu, 4, { category: "main" });
      expect(["soup", "salad"]).toContain(order[0].id);
    }
  });

  it("returns no order when the expectation cannot be served", () => {
    const noDessert = menu.filter((item) => item.category !== "dessert");
    const customers = new CustomerSystem(new SeededRandom(5));
    expect(customers.chooseGuestOrder(noDessert, 4, { category: "dessert" })).toHaveLength(0);
    // Without an expectation the same menu still serves an order.
    expect(customers.chooseGuestOrder(noDessert, 4, undefined).length).toBeGreaterThan(0);
  });

  it("seats count sums chair seating capacity", () => {
    const customers = new CustomerSystem();
    expect(
      customers.getAvailableSeatCount([
        { uid: "a", furnitureId: "cafe-chair", position: { x: 1, y: 1 } },
        { uid: "b", furnitureId: "cafe-chair", position: { x: 2, y: 2 } },
        { uid: "c", furnitureId: "round-table", position: { x: 3, y: 3 } },
      ]),
    ).toBe(2);
  });

  it("spawn rate is zero without seats and grows with seat count", () => {
    const customers = new CustomerSystem();
    expect(customers.estimateSpawnRate(3, 0, 3)).toBe(0);
    const small = customers.estimateSpawnRate(3, 2, 3);
    const big = customers.estimateSpawnRate(3, 10, 3);
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThanOrEqual(1);
  });

  it("rolls expectations across all five categories", () => {
    const customers = new CustomerSystem(new SeededRandom(77));
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      seen.add(customers.rollCustomerExpectation().category);
    }
    expect([...seen].sort()).toEqual(["appetizer", "dessert", "drink", "main", "side"]);
  });

  it("daily counters hydrate from save", () => {
    const customers = new CustomerSystem();
    customers.recordServed();
    customers.recordLost(2);
    expect(customers.getDailyServed()).toBe(1);
    expect(customers.getDailyLost()).toBe(2);
    customers.hydrate({ dailyServed: 40, dailyLost: 3 } as SaveGameState);
    expect(customers.getDailyServed()).toBe(40);
    expect(customers.getDailyLost()).toBe(3);
    customers.resetDailyTotals();
    expect(customers.getDailyServed()).toBe(0);
  });
});
