import { beforeEach, describe, expect, it } from "vitest";
import { SaveSystem } from "../systems/SaveSystem";
import { migrateSave } from "../persistence/SaveMigrationService";
import { CURRENT_SAVE_VERSION } from "../persistence/SaveGame";
import type { SaveGameState } from "../components/types";

/** Minimal in-memory localStorage stand-in for node tests. */
class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  keys(): string[] {
    return [...this.map.keys()];
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  (globalThis as Record<string, unknown>).localStorage = storage;
});

const baseSave: SaveGameState = {
  version: CURRENT_SAVE_VERSION,
  money: 500,
  reputation: 2.5,
  dayNumber: 3,
  unlockedRecipeIds: ["toast", "soup"],
  menuRecipeIds: ["toast"],
  furniture: [{ uid: "f1", furnitureId: "cafe-chair", position: { x: 4, y: 4 } }],
  staff: { chefs: 1, waiters: 1, errandBoys: 0 },
};

describe("SaveSystem", () => {
  it("round-trips a save with version stamping", () => {
    const system = new SaveSystem();
    system.save(baseSave, 2);
    const loaded = system.load(2);
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(CURRENT_SAVE_VERSION);
    expect(loaded!.money).toBe(500);
    expect(loaded!.furniture).toEqual(baseSave.furniture);
  });

  it("loads slot 1 from the pre-slots legacy key", () => {
    storage.setItem("cozy-bistro-prototype-save", JSON.stringify(baseSave));
    const system = new SaveSystem();
    const loaded = system.load(1);
    expect(loaded?.money).toBe(500);
  });

  it("quarantines corrupt payloads instead of deleting them", () => {
    const key = "cozy-bistro-prototype-save-slot-3";
    storage.setItem(key, "{not json!!");
    const system = new SaveSystem();
    const warn = console.warn;
    console.warn = () => undefined;
    const result = system.loadWithReport(3);
    console.warn = warn;
    expect(result.save).toBeNull();
    expect(result.quarantined).toBe(true);
    expect(storage.keys().some((k) => k.startsWith(`${key}-corrupt-`))).toBe(true);
    expect(storage.getItem(key)).toBeNull();
  });

  it("clear() removes the slot payload", () => {
    const system = new SaveSystem();
    system.save(baseSave);
    system.clear(1);
    expect(system.load(1)).toBeNull();
  });
});

describe("migrateSave", () => {
  it("accepts a full v1 save", () => {
    const result = migrateSave(baseSave);
    expect(result.ok).toBe(true);
    expect(result.fromVersion).toBe(1);
  });

  it("migrates a versionless legacy save and keeps scene-level optionality", () => {
    const legacy = {
      money: 120,
      reputation: 1,
      dayNumber: 1,
      unlockedRecipeIds: ["toast"],
      furniture: [],
    };
    const result = migrateSave(legacy);
    expect(result.ok).toBe(true);
    const save = result.save!;
    expect(save.version).toBe(CURRENT_SAVE_VERSION);
    // The scene applies its own defaults for omitted optional fields, so
    // migration must not fabricate them:
    expect(save.menuRecipeIds).toBeUndefined();
    expect(save.stockTarget).toBeUndefined();
    expect(save.expansionLevel).toBeUndefined();
    expect(save.staff).toBeUndefined();
  });

  it("normalizes malformed nested entries but keeps the save", () => {
    const result = migrateSave({
      money: 300,
      dayNumber: 2,
      unlockedRecipeIds: ["toast", 42, null],
      furniture: [
        { uid: "ok", furnitureId: "cafe-chair", position: { x: 1.7, y: 2 } },
        { uid: "bad" },
        null,
      ],
      guests: [{ id: "g1", chairUid: "c1", orderRecipeIds: ["toast"], state: "waitingForFood", patience: 50 }],
      tickets: [
        { id: "t1", guestId: "g1", recipeId: "toast", state: "queued" },
        { id: "t2", guestId: "ghost", recipeId: "soup", state: "ready" },
      ],
    });
    expect(result.ok).toBe(true);
    const save = result.save!;
    expect(save.unlockedRecipeIds).toEqual(["toast"]);
    expect(save.furniture).toHaveLength(1);
    expect(save.furniture[0].position).toEqual({ x: 1, y: 2 });
    expect(save.tickets).toHaveLength(1);
    expect(save.tickets![0].id).toBe("t1");
  });

  it("rejects structurally unusable payloads", () => {
    expect(migrateSave(null).ok).toBe(false);
    expect(migrateSave("nope").ok).toBe(false);
    expect(migrateSave({ money: "lots" }).ok).toBe(false);
    expect(migrateSave({ money: 5 }).ok).toBe(false);
    expect(
      migrateSave({
        money: 5,
        furniture: [],
        version: CURRENT_SAVE_VERSION + 99,
      }).ok,
    ).toBe(false);
  });

  it("clamps absurd numeric ranges instead of trusting input", () => {
    const result = migrateSave({
      money: Number.MAX_VALUE,
      dayNumber: -50,
      dirtyDishCount: 1e12,
      furniture: [],
    });
    expect(result.ok).toBe(true);
    const save = result.save!;
    expect(save.dayNumber).toBe(1);
    expect(save.dirtyDishCount).toBe(10000);
  });
});
