import type { RecipeDefinition } from "../../components/types";

/**
 * Orders as first-class entities (master_plan §15). The scene's MealTicket
 * struct mirrors these states so live and headless semantics stay aligned.
 */

export type OrderState = "queued" | "cooking" | "ready" | "picked-up" | "served" | "completed" | "cancelled";

export interface Order {
  id: string;
  guestId: string;
  recipe: RecipeDefinition;
  state: OrderState;
  createdAt: number;
  cookingStartedAt?: number;
  readyAt?: number;
  servedAt?: number;
  /** Reservation (plan §21): the waiter that claimed this ready order. */
  reservedBy?: string;
}

const terminalStates: OrderState[] = ["served", "completed", "cancelled"];

export function isTerminalOrderState(state: OrderState): boolean {
  return terminalStates.includes(state);
}

/** Central queue helpers (plan §15): pending cooking / cooking / ready for delivery. */
export class OrderQueue {
  private orders = new Map<string, Order>();

  add(order: Order): void {
    if (this.orders.has(order.id)) {
      throw new Error(`duplicate order id ${order.id}`);
    }
    this.orders.set(order.id, order);
  }

  get(id: string): Order | undefined {
    return this.orders.get(id);
  }

  update(order: Order): void {
    this.orders.set(order.id, order);
  }

  all(): Order[] {
    return [...this.orders.values()];
  }

  byState(...states: OrderState[]): Order[] {
    return this.all().filter((order) => states.includes(order.state));
  }

  forGuest(guestId: string): Order[] {
    return this.all().filter((order) => order.guestId === guestId);
  }

  /** Oldest first — the default chef policy (plan §19). */
  queuedOrders(): Order[] {
    return this.byState("queued").sort((a, b) => a.createdAt - b.createdAt);
  }

  readyOrders(): Order[] {
    return this.byState("ready").sort((a, b) => (a.readyAt ?? 0) - (b.readyAt ?? 0));
  }

  remove(id: string): Order | undefined {
    const order = this.orders.get(id);
    this.orders.delete(id);
    return order;
  }

  get size(): number {
    return this.orders.size;
  }
}
