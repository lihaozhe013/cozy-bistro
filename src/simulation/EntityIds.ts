/**
 * Stable entity identifiers. Saved state must never rely on
 * Phaser-generated ids; these are our own collision-resistant-enough ids for
 * a single-player save.
 */

let counter = 0;

function randomSegment(): string {
  return Math.floor(Math.random() * 0xffffff).toString(36);
}

export type CustomerId = string;
export type StaffId = string;
export type FurnitureId = string;
export type OrderId = string;
export type SeatId = string;

/** Generate a unique, save-stable id with a readable prefix. */
export function createEntityId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${randomSegment()}`;
}

export const createGuestId = () => createEntityId("guest");
export const createTicketId = () => createEntityId("ticket");
export const createFurnitureUid = () => createEntityId("fur");
export const createStaffId = (role: string, index: number) => `staff_${role}_${index}`;
