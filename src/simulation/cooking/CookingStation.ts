/**
 * Cooking stations (master_plan §17). A station owns parallel slots; each
 * slot cooks at most one order at a time. Time-based so it is trivially
 * deterministic in the headless simulation.
 */

export interface CookingSlot {
  orderId: string | null;
  /** ms of cook time required for the current order. */
  requiredMs: number;
  elapsedMs: number;
}

export interface CookingStationState {
  id: string;
  level: number;
  speedMultiplier: number;
  slots: CookingSlot[];
}

export class CookingStation {
  readonly state: CookingStationState;

  constructor(id: string, slotCount: number, level = 1, speedMultiplier = 1) {
    this.state = {
      id,
      level,
      speedMultiplier,
      slots: Array.from({ length: Math.max(1, slotCount) }, () => ({
        orderId: null,
        requiredMs: 0,
        elapsedMs: 0,
      })),
    };
  }

  freeSlotIndex(): number | null {
    const index = this.state.slots.findIndex((slot) => slot.orderId === null);
    return index === -1 ? null : index;
  }

  start(orderId: string, cookMs: number, slotIndex: number): void {
    const slot = this.state.slots[slotIndex];
    if (!slot || slot.orderId !== null) {
      throw new Error(`station slot ${slotIndex} unavailable`);
    }
    slot.orderId = orderId;
    slot.requiredMs = Math.max(1, cookMs / this.state.speedMultiplier);
    slot.elapsedMs = 0;
  }

  /** Advances all slots by deltaMs and returns the order ids that just finished. */
  tick(deltaMs: number): string[] {
    const finished: string[] = [];
    for (const slot of this.state.slots) {
      if (slot.orderId === null) {
        continue;
      }
      slot.elapsedMs += deltaMs;
      if (slot.elapsedMs >= slot.requiredMs) {
        finished.push(slot.orderId);
        slot.orderId = null;
        slot.elapsedMs = 0;
        slot.requiredMs = 0;
      }
    }
    return finished;
  }

  /** Remove an in-flight order (guest left angry): the dish returns to the queue. */
  cancel(orderId: string): boolean {
    let cancelled = false;
    for (const slot of this.state.slots) {
      if (slot.orderId === orderId) {
        slot.orderId = null;
        slot.elapsedMs = 0;
        slot.requiredMs = 0;
        cancelled = true;
      }
    }
    return cancelled;
  }

  busySlotCount(): number {
    return this.state.slots.filter((slot) => slot.orderId !== null).length;
  }
}
