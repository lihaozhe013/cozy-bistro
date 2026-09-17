import type { RecipeDefinition } from "../../components/types";
import type { CustomerArchetypeId } from "../../data/customers";

/**
 * Customer state machine (master_plan §12). Transitions are centralized in
 * RestaurantSimulation; this module owns the state vocabulary, allowed
 * transitions, and patience math so they can be reasoned about (and tested)
 * in isolation.
 */

export type SimCustomerState =
  | "entering"
  | "walking-to-seat"
  | "ordering"
  | "waiting-for-food"
  | "eating"
  | "walking-to-counter"
  | "waiting-for-payment"
  | "paying"
  | "leaving"
  | "done"
  | "leaving-angry";

const allowedTransitions: Record<SimCustomerState, SimCustomerState[]> = {
  entering: ["walking-to-seat", "leaving-angry"],
  "walking-to-seat": ["ordering", "leaving-angry"],
  ordering: ["waiting-for-food", "leaving-angry"],
  "waiting-for-food": ["eating", "leaving-angry"],
  eating: ["walking-to-counter", "waiting-for-payment", "leaving-angry"],
  "walking-to-counter": ["paying"],
  "waiting-for-payment": ["paying"],
  paying: ["leaving"],
  leaving: ["done"],
  "leaving-angry": ["done"],
  done: [],
};

export function canTransitionCustomerState(from: SimCustomerState, to: SimCustomerState): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

export interface SimCustomer {
  id: string;
  state: SimCustomerState;
  archetypeId: CustomerArchetypeId;
  seatIndex: number;
  orderRecipeIds: string[];
  /** ms spent in queue/waiting states, used for patience (§13). */
  waitedMs: number;
  patienceMs: number;
  stateSince: number;
  /** Bill locked in when the last dish was served (scene parity: bills are per-ticket). */
  servedValue: number;
}

/** Patience budget: base + per-dish allowance (mirrors GameScene's formula shape). */
export function computePatienceMs(dishes: RecipeDefinition[], baseMs: number, perDishMs: number): number {
  const cookMs = dishes.reduce((sum, recipe) => sum + recipe.preparationTimeSeconds * 1000, 0);
  return baseMs + perDishMs * dishes.length + cookMs;
}

export function isHungryState(state: SimCustomerState): boolean {
  return state === "ordering" || state === "waiting-for-food";
}

export function isFinishedState(state: SimCustomerState): boolean {
  return state === "done";
}
