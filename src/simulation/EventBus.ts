/**
 * Gameplay event bus (master_plan §33). Simulation logic publishes facts;
 * rendering, audio, and feedback systems subscribe. The simulation must never
 * import particle/audio code directly.
 */

export type GameEventMap = {
  "customer-arrived": { guestId: string };
  "customer-seated": { guestId: string; seatUid: string };
  "customer-left-angry": { guestId: string };
  "customer-paid": { guestId: string; amount: number; tip: number };
  "order-created": { ticketId: string; guestId: string; recipeId: string };
  "order-ready": { ticketId: string; recipeId: string };
  "order-served": { ticketId: string; guestId: string; recipeId: string };
  "order-cancelled": { ticketId: string; reason: string };
  "upgrade-purchased": { upgradeId: string; level: number; costText: string };
  "area-unlocked": { level: number; name: string; cost: number };
  "staff-hired": { role: string; index: number };
  "staff-fired": { role: string };
  "day-rolled-over": { dayNumber: number };
  "money-earned": { amount: number; source: string; x?: number; y?: number };
  "recipe-unlocked": { recipeId: string };
};

export type GameEventName = keyof GameEventMap;

type Listener<K extends GameEventName> = (payload: GameEventMap[K]) => void;

export class EventBus {
  private listeners = new Map<GameEventName, Set<Listener<GameEventName>>>();

  on<K extends GameEventName>(name: K, listener: Listener<K>): () => void {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set();
      this.listeners.set(name, set);
    }
    const erased = listener as Listener<GameEventName>;
    set.add(erased);
    return () => {
      set.delete(erased);
    };
  }

  emit<K extends GameEventName>(name: K, payload: GameEventMap[K]): void {
    const set = this.listeners.get(name);
    if (!set) {
      return;
    }
    for (const listener of set) {
      try {
        (listener as Listener<K>)(payload);
      } catch (error) {
        // A broken subscriber must never take down the simulation (plan §58).
        console.error(`[event-bus] listener error for "${name}"`, error);
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

/** Shared application-wide bus. Scene code and systems both reference it. */
export const gameEvents = new EventBus();
