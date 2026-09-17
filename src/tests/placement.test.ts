import { describe, expect, it } from "vitest";
import { FurniturePlacementSystem } from "../systems/FurniturePlacementSystem";
import { RestaurantGridSystem } from "../systems/RestaurantGridSystem";
import { EconomySystem } from "../systems/EconomySystem";
import type { FurnitureDefinition, GridPosition, PlacedFurniture } from "../components/types";

/**
 * Minimal structural stand-in for RestaurantGridSystem so placement rules can
 * be tested headlessly (no Phaser). All items are treated as 1x1.
 */
function createFakeGrid(width = 10, height = 10): RestaurantGridSystem {
  const cellsFor = (_definition: FurnitureDefinition, position: GridPosition) => [position];
  const grid = {
    canPlace(
      definition: FurnitureDefinition,
      position: GridPosition,
      items: PlacedFurniture[],
      ignoreUid?: string,
    ): boolean {
      if (position.x < 0 || position.y < 0 || position.x >= width || position.y >= height) {
        return false;
      }
      const occupied = cellsFor(definition, position);
      return !items.some((item) => {
        if (item.uid === ignoreUid) {
          return false;
        }
        const definitionItem = item as PlacedFurniture;
        return (
          definitionItem.position.x === occupied[0].x && definitionItem.position.y === occupied[0].y
        );
      });
    },
    getOccupiedCells(definition: FurnitureDefinition, position: GridPosition): GridPosition[] {
      return cellsFor(definition, position);
    },
    isInside(position: GridPosition): boolean {
      return position.x >= 0 && position.y >= 0 && position.x < width && position.y < height;
    },
  };
  return grid as unknown as RestaurantGridSystem;
}

const chair: PlacedFurniture = { uid: "chair-1", furnitureId: "cafe-chair", position: { x: 2, y: 2 } };

function createSystem(money = 500) {
  const economy = new EconomySystem(money);
  const placement = new FurniturePlacementSystem(createFakeGrid(), economy, [chair]);
  return { economy, placement };
}

describe("FurniturePlacementSystem", () => {
  it("places affordable furniture and charges the economy", () => {
    const { economy, placement } = createSystem();
    placement.selectCatalogItem("cafe-chair");
    const result = placement.tryPlaceSelected({ x: 5, y: 5 });
    expect(result.ok).toBe(true);
    expect(placement.getFurniture()).toHaveLength(2);
    expect(economy.getMoney()).toBe(500 - 20);
  });

  it("refuses placement when funds are short and spends nothing", () => {
    const { economy, placement } = createSystem(5);
    placement.selectCatalogItem("cafe-chair");
    const result = placement.tryPlaceSelected({ x: 5, y: 5 });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Not enough money");
    expect(economy.getMoney()).toBe(5);
    expect(placement.getFurniture()).toHaveLength(1);
  });

  it("refuses placement onto occupied or out-of-bounds cells", () => {
    const { placement } = createSystem();
    placement.selectCatalogItem("cafe-chair");
    expect(placement.tryPlaceSelected({ x: 2, y: 2 }).ok).toBe(false);
    expect(placement.tryPlaceSelected({ x: 99, y: 0 }).ok).toBe(false);
  });

  it("selecting an occupied empty-spot click picks the existing item (no selection mode)", () => {
    const { placement } = createSystem();
    const result = placement.tryPlaceSelected({ x: 2, y: 2 });
    expect(result.ok).toBe(true);
    expect(placement.getSelectedPlacedUid()).toBe("chair-1");
  });

  it("moves selected furniture to a free cell but not onto an occupied one", () => {
    const { placement } = createSystem();
    placement.selectPlacedFurniture("chair-1");
    expect(placement.tryMoveSelected({ x: 3, y: 4 }).ok).toBe(true);
    placement.selectPlacedFurniture("chair-1");
    expect(placement.tryMoveSelected({ x: 3, y: 4 }).ok).toBe(true);
    const moved = placement.getFurniture()[0];
    expect(moved.position).toEqual({ x: 3, y: 4 });
  });

  it("sells furniture for half cost (floored)", () => {
    const { economy, placement } = createSystem();
    const result = placement.removeAt({ x: 2, y: 2 });
    expect(result.ok).toBe(true);
    expect(economy.getMoney()).toBe(500 + 10);
    expect(placement.getFurniture()).toHaveLength(0);
    expect(placement.removeAt({ x: 2, y: 2 }).ok).toBe(false);
  });

  it("every catalog id resolves to a definition (startup validation §79)", () => {
    const { placement } = createSystem();
    placement.selectCatalogItem("square-table");
    expect(placement.tryPlaceSelected({ x: 1, y: 1 }).ok).toBe(true);
  });

  it("assigns unique stable uids (no Phaser RNG)", () => {
    const { placement } = createSystem(100000);
    const seen = new Set<string>();
    placement.selectCatalogItem("cafe-chair");
    for (let x = 0; x < 9; x += 1) {
      const result = placement.tryPlaceSelected({ x, y: 6 });
      if (result.ok) {
        const uid = placement.getFurniture().at(-1)!.uid;
        expect(uid.startsWith("fur_")).toBe(true);
        expect(seen.has(uid)).toBe(false);
        seen.add(uid);
      }
      placement.clearSelection();
      placement.selectCatalogItem("cafe-chair");
    }
    expect(seen.size).toBeGreaterThan(5);
  });
});
