import type { SaveGameState } from "../components/types";

/**
 * Save format versioning (master_plan §43). Bump when the on-disk shape
 * changes and register a migration in SaveMigrationService.
 */
export const CURRENT_SAVE_VERSION = 1;

/** On-disk envelope: the gameplay state plus its schema version. */
export type VersionedSaveGame = SaveGameState & { version: number };

export function isVersionedSave(value: unknown): value is VersionedSaveGame {
  return typeof value === "object" && value !== null && "money" in value;
}
