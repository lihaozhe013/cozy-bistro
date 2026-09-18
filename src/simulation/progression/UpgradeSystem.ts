import {
  computeUpgradeEffects,
  getUpgradeCost,
  getUpgradeDefinition,
  upgradesById,
  type UpgradeEffects,
  type UpgradeTarget,
} from "../../data/upgrades";
import type { EconomySystem } from "../../systems/EconomySystem";
import type { EventBus } from "../EventBus";

/**
 * Owns purchased upgrade levels and their runtime effects.
 * All transactions go through EconomySystem; purchases emit
 * `upgrade-purchased` so feedback/audio can subscribe.
 */
export class UpgradeSystem {
  private levels: Partial<Record<UpgradeTarget, number>> = {};
  private effectsCache: UpgradeEffects | null = null;

  constructor(
    private readonly economy: EconomySystem,
    private readonly events?: EventBus,
  ) {}

  getLevel(id: UpgradeTarget): number {
    return this.levels[id] ?? 0;
  }

  getLevelsSnapshot(): Record<string, number> {
    return { ...this.levels } as Record<string, number>;
  }

  isMaxed(id: UpgradeTarget): boolean {
    return this.getLevel(id) >= getUpgradeDefinition(id).maxLevel;
  }

  /** Cost of the next level; Infinity at max. */
  cost(id: UpgradeTarget): number {
    return getUpgradeCost(id, this.getLevel(id));
  }

  canAfford(id: UpgradeTarget): boolean {
    return !this.isMaxed(id) && this.economy.canAfford(this.cost(id));
  }

  effects(): UpgradeEffects {
    if (!this.effectsCache) {
      this.effectsCache = computeUpgradeEffects(this.levels);
    }
    return this.effectsCache;
  }

  /** Buy one level. Returns the new level, or null when blocked. */
  purchase(id: UpgradeTarget): number | null {
    if (!upgradesById.has(id) || this.isMaxed(id)) {
      return null;
    }
    const cost = this.cost(id);
    if (!this.economy.spendMoney(cost, "unlock")) {
      return null;
    }
    const next = this.getLevel(id) + 1;
    this.levels[id] = next;
    this.effectsCache = null;
    this.events?.emit("upgrade-purchased", {
      upgradeId: id,
      level: next,
      costText: `$${cost}`,
    });
    return next;
  }

  hydrate(levels?: Record<string, number>): void {
    this.levels = {};
    if (!levels) {
      return;
    }
    for (const [rawId, rawLevel] of Object.entries(levels)) {
      const definition = upgradesById.get(rawId as UpgradeTarget);
      if (!definition) {
        continue;
      }
      const level = Math.floor(Number(rawLevel) || 0);
      if (level > 0) {
        this.levels[rawId as UpgradeTarget] = Math.min(level, definition.maxLevel);
      }
    }
    this.effectsCache = null;
  }
}
