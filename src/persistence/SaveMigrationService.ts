import type {
  GridPosition,
  IngredientStock,
  PlacedFurniture,
  SavedGuestState,
  SavedStaffActorState,
  SavedTicketState,
  SaveGameState,
  TransactionLogEntry,
} from "../components/types";
import { CURRENT_SAVE_VERSION } from "./SaveGame";

/**
 * Save migration + validation for the save-integrity contract in SPEC.md. Raw
 * localStorage JSON
 * is never trusted: it is parsed, shape-validated, and migrated to the
 * current version, or rejected so the caller can start a safe default game.
 */

export interface MigrationResult {
  ok: boolean;
  save?: SaveGameState;
  fromVersion?: number;
  reason?: string;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function intInRange(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(finiteNumber(value, fallback));
  return Math.min(max, Math.max(min, n));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function gridPosition(value: unknown): GridPosition | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { x, y } = value as Record<string, unknown>;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x: Math.floor(x), y: Math.floor(y) };
}

function migrateFurniture(value: unknown): PlacedFurniture[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }
    const entry = item as Record<string, unknown>;
    const position = gridPosition(entry.position);
    if (typeof entry.uid !== "string" || typeof entry.furnitureId !== "string" || !position) {
      return [];
    }
    const furniture: PlacedFurniture = { uid: entry.uid, furnitureId: entry.furnitureId, position };
    if (typeof entry.rotation === "number" && Number.isFinite(entry.rotation)) {
      furniture.rotation = Math.floor(entry.rotation);
    }
    if (Array.isArray(entry.disabledSeatIndexes)) {
      furniture.disabledSeatIndexes = entry.disabledSeatIndexes.filter(
        (index): index is number => typeof index === "number" && Number.isFinite(index),
      );
    }
    return [furniture];
  });
}

function migrateIngredients(value: unknown): IngredientStock[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }
    const entry = item as Record<string, unknown>;
    if (typeof entry.id !== "string") {
      return [];
    }
    return [
      {
        id: entry.id,
        name: typeof entry.name === "string" ? entry.name : entry.id,
        quantity: Math.max(0, Math.floor(finiteNumber(entry.quantity, 0))),
      },
    ];
  });
}

function migrateNumberRecord(value: unknown, floorValue = true): Record<string, number> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      out[key] = floorValue ? Math.floor(raw) : raw;
    }
  }
  return out;
}

const guestStates: SavedGuestState["state"][] = ["waitingToOrder", "waitingForFood"];
const ticketStates: SavedTicketState["state"][] = ["ordering", "queued", "ready", "delivered"];
const staffRoles: SavedStaffActorState["role"][] = ["chef", "waiter", "errand"];

function migrateGuests(value: unknown): SavedGuestState[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }
    const entry = item as Record<string, unknown>;
    if (typeof entry.id !== "string" || typeof entry.chairUid !== "string") {
      return [];
    }
    if (!guestStates.includes(entry.state as SavedGuestState["state"])) {
      return [];
    }
    const guest: SavedGuestState = {
      id: entry.id,
      chairUid: entry.chairUid,
      orderRecipeIds: stringArray(entry.orderRecipeIds),
      state: entry.state as SavedGuestState["state"],
      patience: finiteNumber(entry.patience, 60),
    };
    if (entry.archetypeId === "regular" || entry.archetypeId === "foodie" || entry.archetypeId === "family") {
      guest.archetypeId = entry.archetypeId;
    }
    if (typeof entry.seatUid === "string") {
      guest.seatUid = entry.seatUid;
    }
    return [guest];
  });
}

function migrateTickets(value: unknown): SavedTicketState[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }
    const entry = item as Record<string, unknown>;
    if (typeof entry.id !== "string" || typeof entry.guestId !== "string" || typeof entry.recipeId !== "string") {
      return [];
    }
    if (!ticketStates.includes(entry.state as SavedTicketState["state"])) {
      return [];
    }
    const ticket: SavedTicketState = {
      id: entry.id,
      guestId: entry.guestId,
      recipeId: entry.recipeId,
      state: entry.state as SavedTicketState["state"],
    };
    if (typeof entry.preferredWaiterId === "string") {
      ticket.preferredWaiterId = entry.preferredWaiterId;
    }
    return [ticket];
  });
}

function migrateStaffActors(value: unknown): SavedStaffActorState[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }
    const entry = item as Record<string, unknown>;
    if (!staffRoles.includes(entry.role as SavedStaffActorState["role"])) {
      return [];
    }
    return [
      {
        role: entry.role as SavedStaffActorState["role"],
        index: intInRange(entry.index, 0, 99, 0),
        x: finiteNumber(entry.x, 0),
        y: finiteNumber(entry.y, 0),
      },
    ];
  });
}

function migrateTransactionLog(value: unknown): TransactionLogEntry[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }
    const entry = item as Record<string, unknown>;
    if (typeof entry.transaction !== "string") {
      return [];
    }
    return [
      {
        at: finiteNumber(entry.at, Date.now()),
        transaction: entry.transaction,
        amount: Math.round(finiteNumber(entry.amount, 0)),
        balance: Math.round(finiteNumber(entry.balance, 0)),
      },
    ];
  });
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Migrate any stored JSON (v0 = versionless legacy, v1 = current) to a
 * validated SaveGameState. Returns ok:false with a reason when the payload is
 * unrecoverable (caller should fall back to a new game and back up the file).
 */
export function migrateSave(raw: unknown): MigrationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: "Save root is not an object" };
  }
  const save = raw as Record<string, unknown>;

  // Core sanity gate: without these, nothing downstream can hydrate safely.
  if (typeof save.money !== "number" || !Number.isFinite(save.money)) {
    return { ok: false, reason: "Missing or invalid money" };
  }
  if (!Array.isArray(save.furniture)) {
    return { ok: false, reason: "Missing furniture list" };
  }

  const declaredVersion = finiteNumber(save.version, 0);
  if (declaredVersion > CURRENT_SAVE_VERSION) {
    return { ok: false, reason: `Save version ${declaredVersion} is newer than supported ${CURRENT_SAVE_VERSION}` };
  }
  const fromVersion = intInRange(declaredVersion, 0, CURRENT_SAVE_VERSION, 0);

  // v0 -> v1: identical field names; versioning + strict normalization only.
  // Fields that a legacy save may legitimately omit are preserved as
  // undefined so the scene's own `?? fallback` hydration still applies.
  const result: SaveGameState = {
    version: CURRENT_SAVE_VERSION,
    money: finiteNumber(save.money, 0),
    reputation: finiteNumber(save.reputation, 1),
    dayNumber: intInRange(save.dayNumber, 1, 100000, 1),
    unlockedRecipeIds: stringArray(save.unlockedRecipeIds),
    menuRecipeIds: Array.isArray(save.menuRecipeIds) ? stringArray(save.menuRecipeIds) : undefined,
    recipeUpgradeLevels: migrateNumberRecord(save.recipeUpgradeLevels),
    upgradeLevels: migrateNumberRecord(save.upgradeLevels),
    furniture: migrateFurniture(save.furniture),
    ingredients: migrateIngredients(save.ingredients),
    preparedServings: migrateNumberRecord(save.preparedServings),
    dirtySeatUids: Array.isArray(save.dirtySeatUids) ? stringArray(save.dirtySeatUids) : undefined,
    dirtyDishCount: intInRange(save.dirtyDishCount, 0, 10000, 0),
    restaurantOpen: boolOr(save.restaurantOpen, true),
    autoShopEnabled: boolOr(save.autoShopEnabled, false),
    stockTarget: typeof save.stockTarget === "number" ? intInRange(save.stockTarget, 0, 10000, 20) : undefined,
    ratingTotal: finiteNumber(save.ratingTotal, 0),
    ratingCount: intInRange(save.ratingCount, 0, 1000000, 0),
    ratingHistory: Array.isArray(save.ratingHistory)
      ? save.ratingHistory.map((rating) => finiteNumber(rating, 3))
      : undefined,
    dailyServed: intInRange(save.dailyServed, 0, 1000000, 0),
    dailyLost: intInRange(save.dailyLost, 0, 1000000, 0),
    dailyRevenue: finiteNumber(save.dailyRevenue, 0),
    dailyExpenses: finiteNumber(save.dailyExpenses, 0),
    rentElapsedSeconds: finiteNumber(save.rentElapsedSeconds, 0),
    totalPlaySeconds: finiteNumber(save.totalPlaySeconds, 0),
    expansionLevel:
      typeof save.expansionLevel === "number" ? intInRange(save.expansionLevel, 0, 64, 0) : undefined,
    lastSavedAt: finiteNumber(save.lastSavedAt, 0),
    staff:
      typeof save.staff === "object" && save.staff !== null
        ? {
            chefs: intInRange((save.staff as Record<string, unknown>).chefs, 0, 99, 0),
            waiters: intInRange((save.staff as Record<string, unknown>).waiters, 0, 99, 0),
            errandBoys: intInRange((save.staff as Record<string, unknown>).errandBoys, 0, 99, 0),
          }
        : undefined,
    guests: migrateGuests(save.guests),
    tickets: migrateTickets(save.tickets),
    staffActors: migrateStaffActors(save.staffActors),
    pavementTrash: Array.isArray(save.pavementTrash) ? (save.pavementTrash as SaveGameState["pavementTrash"]) : undefined,
    transactionLog: migrateTransactionLog(save.transactionLog),
    adminSettings:
      typeof save.adminSettings === "object" && save.adminSettings !== null && !Array.isArray(save.adminSettings)
        ? (save.adminSettings as SaveGameState["adminSettings"])
        : undefined,
  };

  // Ticket references must point at persisted guests; drop orphans.
  if (result.guests && result.tickets) {
    const guestIds = new Set(result.guests.map((guest) => guest.id));
    result.tickets = result.tickets.filter((ticket) => guestIds.has(ticket.guestId));
  }

  return { ok: true, save: result, fromVersion };
}

/** Referential check used at startup against live recipe data. */
export function pruneUnknownRecipes(save: SaveGameState, knownRecipeIds: Set<string>): SaveGameState {
  save.unlockedRecipeIds = save.unlockedRecipeIds.filter((id) => knownRecipeIds.has(id));
  save.menuRecipeIds = (save.menuRecipeIds ?? []).filter((id) => knownRecipeIds.has(id));
  if (save.menuRecipeIds.length === 0) {
    save.menuRecipeIds = save.unlockedRecipeIds.filter(
      (id) => knownRecipeIds.has(id),
    );
  }
  save.recipeUpgradeLevels = Object.fromEntries(
    Object.entries(save.recipeUpgradeLevels ?? {}).filter(([id]) => knownRecipeIds.has(id)),
  );
  return save;
}
