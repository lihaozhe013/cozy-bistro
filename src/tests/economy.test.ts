import { describe, expect, it } from "vitest";
import { EconomySystem } from "../systems/EconomySystem";
import type { SaveGameState } from "../components/types";
import { ManualClock } from "../simulation/GameClock";

describe("EconomySystem", () => {
  it("tracks affordability and spends exactly", () => {
    const economy = new EconomySystem(100);
    expect(economy.canAfford(100)).toBe(true);
    expect(economy.canAfford(101)).toBe(false);
    expect(economy.spendMoney(60, "decor")).toBe(true);
    expect(economy.getMoney()).toBe(40);
    expect(economy.spendMoney(50, "decor")).toBe(false);
    expect(economy.getMoney()).toBe(40);
  });

  it("income increases money and daily revenue", () => {
    const economy = new EconomySystem(50);
    economy.earnMoney(25, "payment");
    expect(economy.getMoney()).toBe(75);
    expect(economy.getDailyRevenue()).toBe(25);
    economy.earnMoney(10, "grant");
    expect(economy.getDailyRevenue()).toBe(25);
  });

  it("forced spending can drive the balance negative (rent model)", () => {
    const economy = new EconomySystem(10);
    economy.forceSpendMoney(30, "rent");
    expect(economy.getMoney()).toBe(-20);
    expect(economy.getDailyExpenses()).toBe(30);
  });

  it("records rounded transactions with running balance using the injected clock", () => {
    const clock = new ManualClock(12345);
    const economy = new EconomySystem(100, clock);
    economy.earnMoney(12.6, "payment");
    const log = economy.getTransactionLog();
    expect(log).toHaveLength(1);
    expect(log[0].at).toBe(12345);
    expect(log[0].amount).toBe(13);
    expect(log[0].balance).toBe(113);
    expect(log[0].transaction).toContain("+$13");
  });

  it("caps the transaction log at the save limit", () => {
    const economy = new EconomySystem(100000);
    for (let i = 0; i < 5100; i += 1) {
      economy.recordTransaction(`t${i}`, 1);
    }
    expect(economy.getTransactionLog().length).toBeLessThanOrEqual(5000);
    expect(economy.getTransactionLogForSave().length).toBe(5000);
    expect(economy.getTransactionLogForSave()[0].transaction).toContain("t100");
  });

  it("refunds expenses without crediting revenue", () => {
    const economy = new EconomySystem(100);
    economy.spendMoney(40, "ingredients");
    economy.refundDailyExpenses(15);
    expect(economy.getDailyExpenses()).toBe(25);
    expect(economy.getDailyRevenue()).toBe(0);
  });

  it("hydrates daily totals and log from a save snapshot", () => {
    const economy = new EconomySystem(0);
    economy.hydrate({
      dailyRevenue: 250,
      dailyExpenses: 90,
      transactionLog: [
        { at: 1, transaction: "Customer payment +$20", amount: 20, balance: 20 },
        { at: 2, transaction: "Junk", amount: Number.NaN as unknown as number },
      ] as never,
    } as unknown as SaveGameState);
    expect(economy.getDailyRevenue()).toBe(250);
    expect(economy.getDailyExpenses()).toBe(90);
    const log = economy.getTransactionLog();
    expect(log).toHaveLength(2);
    expect(log[1].at).toBeGreaterThan(0);
    expect(log[1].amount).toBe(0);
  });
});
