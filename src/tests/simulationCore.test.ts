import { describe, expect, it } from "vitest";
import { between, clamp, pick, SeededRandom } from "../simulation/Random";
import { ManualClock } from "../simulation/GameClock";
import { createEntityId } from "../simulation/EntityIds";
import { EventBus } from "../simulation/EventBus";

describe("SeededRandom", () => {
  it("reproduces the same sequence for the same seed", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    for (let i = 0; i < 100; i += 1) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("stays in [0, 1)", () => {
    const rng = new SeededRandom(7);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("between is inclusive on both ends", () => {
    const rng = new SeededRandom(1);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) {
      seen.add(between(rng, 1, 3));
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
    for (let i = 0; i < 500; i += 1) {
      const value = between(rng, 5, 5);
      expect(value).toBe(5);
    }
  });

  it("pick returns array members", () => {
    const rng = new SeededRandom(3);
    const items = ["a", "b", "c"];
    for (let i = 0; i < 100; i += 1) {
      expect(items).toContain(pick(rng, items));
    }
  });
});

describe("clamp", () => {
  it("matches Phaser.Math.Clamp semantics", () => {
    expect(clamp(1, 2, 5)).toBe(2);
    expect(clamp(9, 2, 5)).toBe(5);
    expect(clamp(3, 2, 5)).toBe(3);
    expect(clamp(NaN, 2, 5)).toBe(NaN);
  });
});

describe("ManualClock", () => {
  it("only advances when told", () => {
    const clock = new ManualClock(1000);
    expect(clock.now()).toBe(1000);
    clock.advance(500);
    expect(clock.now()).toBe(1500);
    clock.set(0);
    expect(clock.now()).toBe(0);
  });
});

describe("createEntityId", () => {
  it("produces unique prefixed ids", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      const id = createEntityId("guest");
      expect(id.startsWith("guest_")).toBe(true);
      ids.add(id);
    }
    expect(ids.size).toBe(1000);
  });
});

describe("EventBus", () => {
  it("delivers payloads and unsubscribes", () => {
    const bus = new EventBus();
    const received: number[] = [];
    const off = bus.on("money-earned", (payload) => received.push(payload.amount));
    bus.emit("money-earned", { amount: 12, source: "payment" });
    off();
    bus.emit("money-earned", { amount: 30, source: "payment" });
    expect(received).toEqual([12]);
  });

  it("a throwing listener does not break other listeners", () => {
    const bus = new EventBus();
    let secondCalled = false;
    bus.on("order-ready", () => {
      throw new Error("boom");
    });
    bus.on("order-ready", () => {
      secondCalled = true;
    });
    const spy = console.error;
    console.error = () => undefined;
    bus.emit("order-ready", { ticketId: "t1", recipeId: "toast" });
    console.error = spy;
    expect(secondCalled).toBe(true);
  });
});
