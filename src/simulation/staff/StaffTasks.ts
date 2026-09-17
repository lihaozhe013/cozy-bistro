/**
 * Staff task model (master_plan §18–§21). Every unit of staff work is an
 * explicit, reservable task so two staff members can never claim the same
 * job. Deep nested scene conditionals are replaced by "select task ->
 * execute -> complete" in RestaurantSimulation.
 */

export type StaffRole = "chef" | "waiter";

export type StaffTask =
  | { kind: "cook"; orderId: string; stationId: string }
  | { kind: "deliver"; orderId: string }
  | { kind: "collect-payment"; guestId: string }
  | { kind: "clean-table"; guestId: string };

export type TaskTarget =
  | { type: "order"; id: string }
  | { type: "guest"; id: string }
  | { type: "seat"; id: string };

export function taskTarget(task: StaffTask): TaskTarget {
  switch (task.kind) {
    case "cook":
    case "deliver":
      return { type: "order", id: task.orderId };
    case "collect-payment":
    case "clean-table":
      return { type: "guest", id: task.guestId };
  }
}

/**
 * Reservation ledger (§21). A staff member reserves a task's target before
 * acting; the reservation is released on completion or when the task becomes
 * invalid. Re-reserving the same target by the same staff is a no-op.
 */
export class TaskReservationRegistry {
  private reserved = new Map<string, string>(); // targetKey -> staffId

  private key(target: TaskTarget): string {
    return `${target.type}:${target.id}`;
  }

  isReserved(target: TaskTarget): boolean {
    return this.reserved.has(this.key(target));
  }

  reservedBy(target: TaskTarget): string | undefined {
    return this.reserved.get(this.key(target));
  }

  /** Reserve for a staff member. Returns false when another staff already holds it. */
  reserve(staffId: string, target: TaskTarget): boolean {
    const key = this.key(target);
    const holder = this.reserved.get(key);
    if (holder === undefined) {
      this.reserved.set(key, staffId);
      return true;
    }
    return holder === staffId;
  }

  release(staffId: string, target: TaskTarget): void {
    const key = this.key(target);
    if (this.reserved.get(key) === staffId) {
      this.reserved.delete(key);
    }
  }

  /** Release a target regardless of holder (stage transition: cooked dish becomes claimable). */
  releaseTarget(target: TaskTarget): void {
    this.reserved.delete(this.key(target));
  }

  /** Release every reservation held by a staff member (task became invalid / recovery). */
  releaseAllFor(staffId: string): string[] {
    const released: string[] = [];
    for (const [key, holder] of this.reserved.entries()) {
      if (holder === staffId) {
        this.reserved.delete(key);
        released.push(key);
      }
    }
    return released;
  }

  /** Drop reservations whose targets no longer exist (invalidation sweep, §21/§58). */
  prune(validTargetKeys: Set<string>): void {
    for (const key of [...this.reserved.keys()]) {
      if (!validTargetKeys.has(key)) {
        this.reserved.delete(key);
      }
    }
  }

  count(): number {
    return this.reserved.size;
  }
}

export interface SimStaff {
  id: string;
  role: StaffRole;
  /** current task, or null while idle/moving between tasks */
  task: StaffTask | null;
  /** ms remaining in the active execution step (walk or work). */
  busyUntilElapsed: number;
  totalWorkMs: number;
  totalIdleMs: number;
}

export function createSimStaff(id: string, role: StaffRole): SimStaff {
  return { id, role, task: null, busyUntilElapsed: 0, totalWorkMs: 0, totalIdleMs: 0 };
}
