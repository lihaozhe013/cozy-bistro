import type { GridPosition } from "../components/types";

/**
 * Restaurant expansion definitions (master_plan §28). Areas are visible and
 * purchasable in order; each carries its grid cells and an in-world sign
 * position. Locked areas render a lock + price sign so the player can see
 * what they are saving toward.
 */

export interface ExpansionDefinition {
  level: number;
  name: string;
  kind: "interior" | "yard";
  direction: "north" | "right" | "left";
  cells: GridPosition[];
  signPosition: GridPosition;
}

export function rectCells(x: number, y: number, width: number, height: number): GridPosition[] {
  const cells: GridPosition[] = [];
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      cells.push({ x: xx, y: yy });
    }
  }
  return cells;
}

/** Starter room footprint (expansion cells must never intersect it). */
export const starterCells: GridPosition[] = rectCells(0, 3, 10, 6);

export const expansionDefinitions: ExpansionDefinition[] = [
  {
    level: 1,
    name: "North Room",
    kind: "interior",
    direction: "north",
    cells: rectCells(0, 0, 10, 3),
    signPosition: { x: 4, y: 1 },
  },
  {
    level: 2,
    name: "Right Room",
    kind: "interior",
    direction: "right",
    cells: rectCells(10, 0, 4, 9),
    signPosition: { x: 11, y: 4 },
  },
  {
    level: 3,
    name: "Left Room",
    kind: "interior",
    direction: "left",
    cells: rectCells(-4, 0, 4, 9),
    signPosition: { x: -3, y: 4 },
  },
  {
    level: 4,
    name: "North Room",
    kind: "interior",
    direction: "north",
    cells: rectCells(-4, -4, 18, 4),
    signPosition: { x: 4, y: -2 },
  },
  {
    level: 5,
    name: "Garden Yard",
    kind: "yard",
    direction: "right",
    cells: rectCells(14, -4, 4, 13),
    signPosition: { x: 15, y: 2 },
  },
  {
    level: 6,
    name: "Left Room",
    kind: "interior",
    direction: "left",
    cells: rectCells(-8, -4, 4, 13),
    signPosition: { x: -7, y: 2 },
  },
  {
    level: 7,
    name: "North Room",
    kind: "interior",
    direction: "north",
    cells: rectCells(-8, -8, 26, 4),
    signPosition: { x: 4, y: -6 },
  },
  {
    level: 8,
    name: "Garden Yard",
    kind: "yard",
    direction: "right",
    cells: rectCells(18, -8, 4, 17),
    signPosition: { x: 19, y: 0 },
  },
];
