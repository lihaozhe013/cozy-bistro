/**
 * Startup validation of data-driven content (master_plan §79). Development
 * builds should fail loudly when content references are broken.
 */

import { furnitureCatalog } from "./furniture";
import { recipes } from "./recipes";
import { customerArchetypes } from "./customers";
import { upgradeDefinitions } from "./upgrades";
import { expansionDefinitions } from "./expansions";
import { findExpansionOverlaps } from "../simulation/progression/Expansion";
import { getStarterPantry } from "../systems/CookingSystem";
export interface ContentIssue {
  severity: "error" | "warning";
  message: string;
}

export function validateContent(): ContentIssue[] {
  const issues: ContentIssue[] = [];

  const furnitureIds = new Set<string>();
  for (const item of furnitureCatalog) {
    if (furnitureIds.has(item.id)) {
      issues.push({ severity: "error", message: `Duplicate furniture id: ${item.id}` });
    }
    furnitureIds.add(item.id);
    if (item.cost < 0) {
      issues.push({ severity: "error", message: `Negative cost on furniture ${item.id}` });
    }
    if (item.size.width < 1 || item.size.height < 1) {
      issues.push({ severity: "error", message: `Invalid size on furniture ${item.id}` });
    }
  }

  const recipeIds = new Set<string>();
  const ingredientIds = new Set(getStarterPantry().map((item) => item.id));
  for (const recipe of recipes) {
    if (recipeIds.has(recipe.id)) {
      issues.push({ severity: "error", message: `Duplicate recipe id: ${recipe.id}` });
    }
    recipeIds.add(recipe.id);
    if (recipe.sellPrice <= 0) {
      issues.push({ severity: "error", message: `Recipe ${recipe.id} has non-positive sellPrice` });
    }
    if (recipe.preparationTimeSeconds <= 0) {
      issues.push({ severity: "error", message: `Recipe ${recipe.id} has non-positive prep time` });
    }
    if (recipe.ingredients.length === 0) {
      issues.push({ severity: "warning", message: `Recipe ${recipe.id} has no ingredients` });
    }
    for (const ingredient of recipe.ingredients) {
      if (!ingredientIds.has(ingredient)) {
        issues.push({ severity: "error", message: `Recipe ${recipe.id} references unknown ingredient ${ingredient}` });
      }
    }
    const tier = recipe.luxuryTier;
    if (tier !== undefined && (tier < 1 || tier > 5)) {
      issues.push({ severity: "error", message: `Recipe ${recipe.id} has invalid luxuryTier ${tier}` });
    }
  }

  const defaultActive = recipes.filter((recipe) => recipe.activeByDefault && (recipe.luxuryTier ?? 1) <= 1);
  if (defaultActive.length === 0) {
    issues.push({ severity: "error", message: "No tier-1 recipe is active by default; a new game would start with an empty menu" });
  }

  const archetypeIds = new Set<string>();
  for (const archetype of customerArchetypes) {
    if (archetypeIds.has(archetype.id)) {
      issues.push({ severity: "error", message: `Duplicate archetype id: ${archetype.id}` });
    }
    archetypeIds.add(archetype.id);
    if (archetype.weight <= 0 || archetype.minOrderItems > archetype.maxOrderItems) {
      issues.push({ severity: "error", message: `Invalid archetype modifiers: ${archetype.id}` });
    }
  }

  const upgradeIds = new Set<string>();
  for (const definition of upgradeDefinitions) {
    if (upgradeIds.has(definition.id)) {
      issues.push({ severity: "error", message: `Duplicate upgrade id: ${definition.id}` });
    }
    upgradeIds.add(definition.id);
    if (definition.baseCost <= 0 || definition.growthRate < 1 || definition.maxLevel < 1) {
      issues.push({ severity: "error", message: `Invalid upgrade curve: ${definition.id}` });
    }
  }

  const expansionLevels = expansionDefinitions.map((definition) => definition.level);
  for (let level = 1; level <= expansionDefinitions.length; level += 1) {
    if (!expansionLevels.includes(level)) {
      issues.push({ severity: "error", message: `Expansion levels are not contiguous (missing ${level})` });
    }
  }
  for (const overlap of findExpansionOverlaps()) {
    issues.push({ severity: "error", message: `Expansion geometry: ${overlap}` });
  }

  return issues;
}

/** Throws on hard errors so a broken content change cannot boot silently. */
export function assertContentValidOrWarn(): ContentIssue[] {
  const issues = validateContent();
  const errors = issues.filter((issue) => issue.severity === "error");
  for (const issue of issues) {
    const line = `[content-validation] ${issue.severity}: ${issue.message}`;
    if (issue.severity === "error") {
      console.error(line);
    } else {
      console.warn(line);
    }
  }
  if (errors.length > 0) {
    throw new Error(`Content validation failed with ${errors.length} error(s); see console output`);
  }
  return issues;
}
