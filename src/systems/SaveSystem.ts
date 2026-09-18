import type { SaveGameState } from "../components/types";
import { CURRENT_SAVE_VERSION } from "../persistence/SaveGame";
import { migrateSave } from "../persistence/SaveMigrationService";

const saveKey = "cozy-bistro-prototype-save";
const slotPrefix = `${saveKey}-slot-`;
const slotCount = 3;

export interface SaveLoadResult {
  save: SaveGameState | null;
  /** True when the stored payload was corrupt/incompatible and got quarantined. */
  quarantined: boolean;
  reason?: string;
}

/**
 * localStorage save repository for the persistence contract in SPEC.md.
 *
 * Writes stamp `version` before serializing. Reads parse -> validate ->
 * migrate, and never delete data: unrecoverable payloads are moved to a
 * `*-corrupt-<timestamp>` key so a human can inspect them, while the game
 * continues from a safe default state.
 */
export class SaveSystem {
  save(state: SaveGameState, slot = 1): { bytes: number; durationMs: number } {
    const startedAt = performance.now();
    const versioned: SaveGameState = { ...state, version: CURRENT_SAVE_VERSION };
    const serialized = JSON.stringify(versioned);
    localStorage.setItem(this.getSlotKey(slot), serialized);
    return {
      bytes: serialized.length,
      durationMs: performance.now() - startedAt,
    };
  }

  getSaveSizeBytes(slot = 1): number {
    const rawSave = this.readRaw(slot);
    return rawSave?.length ?? 0;
  }

  /** Validate + migrate a stored payload. Returns null (after quarantine) on garbage. */
  loadWithReport(slot = 1): SaveLoadResult {
    const key = this.getEffectiveKey(slot);
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) {
      return { save: null, quarantined: false };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      this.quarantine(key, `JSON parse failed: ${String(error)}`);
      return { save: null, quarantined: true, reason: "Corrupted JSON" };
    }

    const migrated = migrateSave(parsed);
    if (!migrated.ok || !migrated.save) {
      this.quarantine(key, migrated.reason ?? "Validation failed");
      return { save: null, quarantined: true, reason: migrated.reason };
    }

    return { save: migrated.save, quarantined: false };
  }

  load(slot = 1): SaveGameState | null {
    return this.loadWithReport(slot).save;
  }

  clear(slot = 1): void {
    localStorage.removeItem(this.getSlotKey(slot));
    if (slot === 1) {
      localStorage.removeItem(saveKey);
    }
  }

  listSlots(): Array<{ slot: number; save: SaveGameState | null }> {
    return Array.from({ length: slotCount }, (_, index) => {
      const slot = index + 1;
      return { slot, save: this.load(slot) };
    });
  }

  getSlotCount(): number {
    return slotCount;
  }

  private readRaw(slot: number): string | null {
    return localStorage.getItem(this.getEffectiveKey(slot));
  }

  /** slot 1 falls back to the original pre-slots key (v0 layout). */
  private getEffectiveKey(slot: number): string {
    const slotKey = this.getSlotKey(slot);
    if (localStorage.getItem(slotKey) !== null) {
      return slotKey;
    }
    if (slot === 1 && localStorage.getItem(saveKey) !== null) {
      return saveKey;
    }
    return slotKey;
  }

  private quarantine(key: string, reason: string): void {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return;
    }
    try {
      localStorage.setItem(`${key}-corrupt-${Date.now()}`, raw);
      localStorage.removeItem(key);
    } catch {
      // Storage full: leave the corrupt entry in place rather than lose data.
    }
    console.warn(`[save] quarantined ${key}: ${reason}`);
  }

  private getSlotKey(slot: number): string {
    return `${slotPrefix}${slot}`;
  }
}
