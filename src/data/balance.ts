/**
 * Central tunable game balance (master_plan §77).
 *
 * Gameplay-tuning numbers live here so rebalancing does not require searching
 * the whole codebase. `GameScene` imports these instead of declaring its own
 * constants. UI layout numbers (panel positions, scroll regions, colours)
 * intentionally stay in the scene — they are presentation, not balance.
 *
 * Values were moved verbatim from GameScene.ts during Milestone 1 so live
 * behaviour is unchanged; tuning happens in Milestone 8.
 */

// --- Economy / starting state ---
export const starterMoney = 520;
export const starterGrantTarget = 220;
export const defaultIngredientUnitCost = 5;
export const defaultStarterRecipeProfit = 3;
export const defaultItemCostMultiplier = 1;
export const pastaUnlockCost = 160;
export const trashRecycleReward = 2;
export const defaultTrashDropChance = 0.05;

// --- Staff & payroll ---
export const maxErrandOrderItems = 12;
export const maxChairsPerTable = 4;

// --- Movement (px/s and personal-space steering) ---
export const customerWalkPixelsPerSecond = 90;
export const staffWalkPixelsPerSecond = 125;
export const pedestrianWalkPixelsPerSecond = 68;
export const standingPersonalSpaceRadius = 24;
export const seatedPersonalSpaceRadius = 16;
export const maxStandingPersonalOffset = 15;
export const maxSeatedPersonalOffset = 2;

// --- Service action durations (seconds) ---
export const orderHandOffSeconds = 0.8;
export const eatingSecondsPerVisit = 30;
export const paymentSeconds = 0.75;
export const cleaningSeconds = 0.8;
export const manualDishwashingSeconds = 2.8;
export const dishwasherSeconds = 2.2;

// --- Customer patience ---
export const patienceBaseSeconds = 55;
export const patiencePerItemSeconds = 14;
export const patienceMinSeconds = 90;
export const patienceMaxSeconds = 260;

// --- Customer spawning ---
/** Spawn interval (ms) = 60000 / spawnRate, scaled, then clamped. */
export const guestSpawnIntervalScale = 1.35;
export const guestSpawnMinMs = 2200;
export const guestSpawnMaxMs = 15000;
export const guestSpawnFallbackMs = 9500;
/** Retry delay when the restaurant is closed / full / has no staff or recipes. */
export const guestBlockedRetryMs = 2500;
/** Retry delay after a turn-away at the door (missing category on menu). */
export const guestTurnawayRetryMs = 2200;
/** Retry delay when the entrance route is temporarily blocked. */
export const guestRerouteRetryMs = 1200;

// --- Street ambience ---
export const maxPedestrians = 8;
export const pedestrianSpawnMinMs = 900;
export const pedestrianSpawnMaxMs = 2100;
export const maxPavementTrash = 30;
export const offlineTrashDropMs = 3 * 60 * 1000;

// --- Rent & expansions ---
export const defaultBaseDailyRent = 0;
export const defaultRentPerExpansion = 0;
export const starterExpansionLevel = 0;
export const legacyExpansionLevel = 2;
export const maxExpansionLevel = 8;
// M8 pacing pass: goal-hoarding playthrough reaches expansion 1 + core upgrades
// inside the plan's 30-60 min window (see pacing.test.ts envelope).
export const defaultFirstExpansionCost = 900;
export const defaultExpansionCostMultiplier = 1.5;

// --- Offline progress ---
/** Minimum away-time before an offline summary is shown (seconds). */
export const offlineMinElapsedSeconds = 60;
/** Hard cap on counted offline time (plan §46). */
export const offlineCapSeconds = 8 * 60 * 60;
/** Safety cap on guests simulated into the estimate per offline window. */
export const offlineMaxServedGuests = 500;

// --- Simulation loop cadence (ms between scheduler passes) ---
export const serviceAssignmentMs = 200;
export const kitchenAssignmentMs = 200;
export const recoveryCheckMs = 1000;
export const autoShopCheckMs = 500;
export const chefSyncMs = 1000;
export const personalSpaceMs = 90;
export const quietSaveDebounceMs = 2200;
