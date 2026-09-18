/**
 * Headless progression-pacing model (master_plan §50/§85).
 *
 * The live scene cannot run in vitest, so this module projects minute-by-minute
 * economy from the SAME data files the game uses (recipes, upgrade cost curves,
 * expansion cost curve, spawn-rate heuristic). It reuses the exact formulas for
 * spawn pull, upgrade costs and expansion costs; only the capacity side is
 * approximated (steady-state averages instead of pathing/patience noise).
 *
 * Purpose: keep "initial complete progression" inside the 30-60 minute design
 * window and catch cost-curve regressions in CI. Re-tuning happens by editing
 * data/balance.ts constants until `pacing.test.ts` envelopes pass again.
 */

import { recipes } from "../../data/recipes";
import { defaultFirstExpansionCost, defaultExpansionCostMultiplier, guestSpawnMinMs, guestSpawnMaxMs, starterMoney } from "../../data/balance";
import { getUpgradeCost, computeUpgradeEffects, upgradeDefinitions } from "../../data/upgrades";
import { expansionCost } from "./Expansion";
import { luxuryTierForExpansion } from "./Expansion";
import { customerArchetypes } from "../../data/customers";
import { estimateSpawnRate } from "../../systems/CustomerSystem";

// Assumptions calibrated against the starter layout + typical player build habits.
const starterSeats = 2;
const starterStoves = 1;
const starterChefs = 1;
const starterWaiters = 1;
const starterAttractiveness = 3;
const starterRating = 3;

/** Seats a player is expected to build when each expansion level opens (cells grow with rooms). */
const seatsPerExpansionLevel = [0, 4, 4, 6, 6, 6, 8, 8, 10];
/** Stoves typically added at the same time (odd levels open kitchen wall lines). */
const stovesPerExpansionLevel = [0, 1, 0, 1, 0, 1, 0, 1, 1];
/** A table + two chairs bought inside already-open space. */
const tableSetCost = 95;

const chefHireBaseCost = 80;
const waiterHireBaseCost = 70;
const hireCostScale = 0.1;

/** Seconds for one waiter round trip at base speed (counter<->table legs, observed in sim). */
const waiterTripSeconds = 12;
/** Minutes of one seat occupancy cycle: enter + order + wait + eat + pay + clean. */
const seatCycleMinutes = 1;
const ingredientUnitCost = 5;

export interface PacingStep {
  minute: number;
  dishesPerMinute: number;
  revenuePerMinute: number;
  money: number;
  expansionLevel: number;
  seats: number;
}

export interface PacingResult {
  totalMinutes: number;
  minutesToExpansion: Record<number, number | null>;
  /** Minutes until every operational upgrade is maxed, or null if never within horizon. */
  minutesToUpgradesComplete: number | null;
  /** Minutes until 80% of all upgrade levels are bought (core build-out). */
  minutesToUpgradesCore: number | null;
  /** Plan's "initial complete progression": L1-L3 rooms + core (80%) upgrades. */
  minutesToInitialProgression: number | null;
  final: PacingStep | null;
  steps: PacingStep[];
}

export interface PacingConfig {
  firstExpansionCost?: number;
  expansionCostMultiplier?: number;
  maxMinutes?: number;
}

interface PacingState {
  seats: number;
  stoves: number;
  chefs: number;
  waiters: number;
  expansionLevel: number;
  levels: Record<string, number>;
  money: number;
}

function defaultLevels(): Record<string, number> {
  const levels: Record<string, number> = {};
  for (const definition of upgradeDefinitions) {
    levels[definition.id] = 0;
  }
  return levels;
}

/** Weighted mean dishes per customer from archetype order-size ranges. */
export function expectedDishesPerCustomer(): number {
  const totalWeight = customerArchetypes.reduce((sum, archetype) => sum + archetype.weight, 0);
  return customerArchetypes.reduce((sum, archetype) => sum + ((archetype.minOrderItems + archetype.maxOrderItems) / 2) * archetype.weight, 0) / totalWeight;
}

/** Weighted mean bill multiplier from archetypes (excludes tips). */
function expectedBillMultiplier(): number {
  const totalWeight = customerArchetypes.reduce((sum, archetype) => sum + archetype.weight, 0);
  return customerArchetypes.reduce((sum, archetype) => sum + archetype.orderValueMultiplier * archetype.weight, 0) / totalWeight;
}

/** Menu available at an expansion level: default recipes plus luxury tiers unlocked by rooms. */
function unlockedRecipesAt(expansionLevel: number): typeof recipes {
  const tier = luxuryTierForExpansion(expansionLevel);
  return recipes.filter((recipe) => recipe.unlockedByDefault || (recipe.luxuryTier ?? 1) <= tier);
}

function capacityPerMinute(state: PacingState): { dishes: number; kitchen: number; service: number; demand: number } {
  const effects = computeUpgradeEffects(state.levels);
  const menu = unlockedRecipesAt(state.expansionLevel);
  if (menu.length === 0 || state.chefs === 0 || state.waiters === 0) {
    return { dishes: 0, kitchen: 0, service: 0, demand: 0 };
  }

  const attractiveness = starterAttractiveness * (1 + effects.attractivenessBonus);
  const rating = Math.min(4.8, starterRating + state.expansionLevel * 0.15);
  const spawnRate = estimateSpawnRate(attractiveness, state.seats, menu.length, rating);
  const intervalMs = Math.min(guestSpawnMaxMs, Math.max(guestSpawnMinMs, 60000 / Math.max(1, spawnRate * effects.spawnRateMultiplier)));
  const guestsPerMinute = 60000 / intervalMs;

  const dishesPerGuest = expectedDishesPerCustomer();
  const seatGuestsPerMinute = state.seats / seatCycleMinutes;
  const demand = Math.min(guestsPerMinute, seatGuestsPerMinute) * dishesPerGuest;

  const averagePrepSeconds = menu.reduce((sum, recipe) => sum + recipe.preparationTimeSeconds, 0) / menu.length;
  const kitchen = (Math.min(state.chefs, state.stoves) * 60) / Math.max(1, averagePrepSeconds / effects.chefCookMultiplier);
  const batchFactor = effects.waiterCarryCapacity >= 3 ? 1.7 : effects.waiterCarryCapacity === 2 ? 1.35 : 1;
  const service = (state.waiters * 60 * batchFactor) / (waiterTripSeconds / effects.waiterSpeedMultiplier);

  return { dishes: Math.min(demand, kitchen, service), kitchen, service, demand };
}

function revenuePerDish(expansionLevel: number, levels: Record<string, number>): number {
  const effects = computeUpgradeEffects(levels);
  const menu = unlockedRecipesAt(expansionLevel);
  if (menu.length === 0) {
    return 0;
  }
  const gross = (menu.reduce((sum, recipe) => sum + recipe.sellPrice, 0) / menu.length) * expectedBillMultiplier();
  const cost = (menu.reduce((sum, recipe) => sum + recipe.ingredients.length, 0) / menu.length) * ingredientUnitCost;
  const averageTipBonus = customerArchetypes.reduce((sum, a) => sum + a.tipChanceBonus * a.weight, 0) / customerArchetypes.reduce((sum, a) => sum + a.weight, 0);
  const tips = gross * Math.min(0.9, effects.tipChance + averageTipBonus * 0.4) * effects.tipMultiplier;
  return Math.max(0, gross - cost + tips);
}

interface PurchaseCandidate {
  cost: number;
  buy: (state: PacingState) => void;
}

/** Starter 10x6 room fits roughly three two-seat tables before expanding. */
const starterSeatAllowance = 6;

function seatsAllowed(expansionLevel: number): number {
  let seats = starterSeatAllowance;
  for (let level = 1; level <= expansionLevel; level += 1) {
    seats += seatsPerExpansionLevel[level];
  }
  return seats;
}

function candidates(state: PacingState, config: Required<PacingConfig>): PurchaseCandidate[] {
  const list: PurchaseCandidate[] = [];

  if (state.seats + 2 <= seatsAllowed(state.expansionLevel)) {
    list.push({ cost: tableSetCost, buy: (s) => (s.seats += 2) });
  }

  for (const definition of upgradeDefinitions) {
    const level = state.levels[definition.id] ?? 0;
    if (level < definition.maxLevel) {
      const cost = getUpgradeCost(definition.id, level);
      list.push({ cost, buy: (s) => (s.levels[definition.id] = level + 1) });
    }
  }


  const capacity = capacityPerMinute(state);
  if (capacity.kitchen <= capacity.demand && state.chefs <= state.stoves) {
    const cost = Math.round(chefHireBaseCost * (1 + state.chefs * hireCostScale));
    list.push({ cost, buy: (s) => (s.chefs += 1) });
  }
  if (capacity.service <= capacity.demand) {
    const cost = Math.round(waiterHireBaseCost * (1 + state.waiters * hireCostScale));
    list.push({ cost, buy: (s) => (s.waiters += 1) });
  }

  return list.sort((a, b) => a.cost - b.cost);
}

/** Money needed for the next expansion plus furnishing the new space. */
function expansionGoal(state: PacingState, config: Required<PacingConfig>): number | null {
  if (state.expansionLevel >= 8) {
    return null;
  }
  const next = state.expansionLevel + 1;
  return (
    expansionCost(next, config.firstExpansionCost, config.expansionCostMultiplier) +
    seatsPerExpansionLevel[next] * 43 +
    stovesPerExpansionLevel[next] * (ingredientUnitCost * 25)
  );
}

/**
 * Purchase policy: players save toward the expansion goal (buying side items
 * only up to a fraction of the goal price) and grab the expansion the moment
 * it is affordable. Pure "buy anything cheapest" never accumulates the goal.
 */
const sideItemGoalShare = 0.35;

function buyPhase(state: PacingState, config: Required<PacingConfig>): boolean {
  const goal = expansionGoal(state, config);
  if (goal !== null && state.money >= goal) {
    const next = state.expansionLevel + 1;
    state.money -= goal;
    state.expansionLevel = next;
    state.seats += seatsPerExpansionLevel[next];
    state.stoves += stovesPerExpansionLevel[next];
    return true;
  }

  const budgetCap = goal === null ? Number.POSITIVE_INFINITY : goal * sideItemGoalShare;
  for (const candidate of candidates(state, config)) {
    if (candidate.cost <= Math.min(state.money, budgetCap)) {
      state.money -= candidate.cost;
      candidate.buy(state);
      return true;
    }
  }
  return false;
}

/** Run the greedy cheapest-first progression model. */
export function simulatePacing(config: PacingConfig = {}): PacingResult {
  const resolved = {
    firstExpansionCost: config.firstExpansionCost ?? defaultFirstExpansionCost,
    expansionCostMultiplier: config.expansionCostMultiplier ?? defaultExpansionCostMultiplier,
    maxMinutes: config.maxMinutes ?? 360,
  };

  const state: PacingState = {
    seats: starterSeats,
    stoves: starterStoves,
    chefs: starterChefs,
    waiters: starterWaiters,
    expansionLevel: 0,
    levels: defaultLevels(),
    money: starterMoney,
  };

  const minutesToExpansion: Record<number, number | null> = {};
  for (let level = 1; level <= 8; level += 1) {
    minutesToExpansion[level] = null;
  }
  minutesToExpansion[0] = 0;

  let minutesToUpgradesComplete: number | null = null;
  let minutesToUpgradesCore: number | null = null;
  const totalUpgradeLevels = upgradeDefinitions.reduce((sum, definition) => sum + definition.maxLevel, 0);
  const steps: PacingStep[] = [];
  let final: PacingStep | null = null;

  for (let minute = 1; minute <= resolved.maxMinutes; minute += 1) {
    const capacity = capacityPerMinute(state);
    const income = capacity.dishes * revenuePerDish(state.expansionLevel, state.levels);
    state.money += income;

    while (buyPhase(state, resolved)) {
      // Keep buying while the policy still finds something worth owning.
    }

    if (minutesToExpansion[state.expansionLevel] === null) {
      minutesToExpansion[state.expansionLevel] = minute;
    }
    const boughtLevels = upgradeDefinitions.reduce((sum, definition) => sum + (state.levels[definition.id] ?? 0), 0);
    if (minutesToUpgradesCore === null && boughtLevels >= totalUpgradeLevels * 0.8) {
      minutesToUpgradesCore = minute;
    }
    if (minutesToUpgradesComplete === null && boughtLevels >= totalUpgradeLevels) {
      minutesToUpgradesComplete = minute;
    }

    final = { minute, dishesPerMinute: capacity.dishes, revenuePerMinute: income, money: Math.round(state.money), expansionLevel: state.expansionLevel, seats: state.seats };
    steps.push(final);

    if (final.expansionLevel >= 8 && minutesToUpgradesComplete !== null) {
      break;
    }
  }

  const initialProgressionMarks = [minutesToExpansion[1], minutesToExpansion[2], minutesToExpansion[3], minutesToUpgradesCore].filter(
    (value): value is number => value !== null,
  );

  return {
    totalMinutes: final?.minute ?? 0,
    minutesToExpansion,
    minutesToUpgradesComplete,
    minutesToUpgradesCore,
    minutesToInitialProgression: initialProgressionMarks.length === 4 ? Math.max(...initialProgressionMarks) : null,
    final,
    steps,
  };
}
