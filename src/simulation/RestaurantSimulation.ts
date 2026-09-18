import type { RecipeDefinition } from "../components/types";
import type { UpgradeEffects } from "../data/upgrades";
import { getCustomerArchetype } from "../data/customers";
import { EconomySystem } from "../systems/EconomySystem";
import { CustomerSystem } from "../systems/CustomerSystem";
import { ManualClock } from "./GameClock";
import { defaultRandomSource, type RandomSource } from "./Random";
import { createGuestId, createTicketId } from "./EntityIds";
import { EventBus } from "./EventBus";
import { CookingStation } from "./cooking/CookingStation";
import { OrderQueue, isTerminalOrderState, type Order } from "./orders/Order";
import {
  canTransitionCustomerState,
  computePatienceMs,
  isHungryState,
  type SimCustomer,
  type SimCustomerState,
} from "./customer/CustomerLogic";
import {
  createSimStaff,
  TaskReservationRegistry,
  type SimStaff,
  type StaffTask,
} from "./staff/StaffTasks";

/**
 * Headless restaurant service-loop simulation (master_plan §9).
 *
 * Executable specification of the customer service loop (M2) and staff
 * automation (M3): customers order, tickets queue, chefs cook oldest-first
 * on station slots, waiters batch-deliver with reservations, payments and
 * cleaning follow priority order, patience expiries recover safely.
 *
 * Acceptance target (plan M2): "spawn 20 customers sequentially: all
 * eventually complete or safely leave; no stuck tables; no duplicate orders;
 * no permanent staff deadlock" — proven in src/tests/restaurantSim.test.ts.
 */

export interface StationConfig {
  id: string;
  slotCount: number;
  /** Station-level cook speed multiplier (kitchen upgrades, plan §17). */
  speedMultiplier?: number;
}

export interface SimulationConfig {
  seatCount: number;
  chefCount: number;
  waiterCount: number;
  stations: StationConfig[];
  menu: RecipeDefinition[];
  maxOrdersPerGuest?: number;
  spawnIntervalMs?: number;
  walkEnterToSeatMs?: number;
  walkExitMs?: number;
  walkToCounterMs?: number;
  walkWaiterLegMs?: number;
  handoffMs?: number;
  eatMs?: number;
  payMs?: number;
  cleanMs?: number;
  patienceBaseMs?: number;
  patiencePerDishMs?: number;
  waiterSpeedMultiplier?: number;
  chefSpeedMultiplier?: number;
  waiterCarryCapacity?: number;
  collectPaymentsAtTable?: boolean;
  /** Stop spawning after this many guests (Infinity by default). */
  maxGuests?: number;
  /** When provided, purchase-driven upgrade effects fold into these timings. */
  effects?: UpgradeEffects;
}

type SimConfigResolved = Required<Omit<SimulationConfig, "stations">> & { stations: Required<StationConfig>[] };

const defaults = {
  maxOrdersPerGuest: 2,
  spawnIntervalMs: 4000,
  walkEnterToSeatMs: 1500,
  walkExitMs: 1500,
  walkToCounterMs: 1200,
  walkWaiterLegMs: 900,
  handoffMs: 300,
  eatMs: 20000,
  payMs: 1000,
  cleanMs: 2000,
  patienceBaseMs: 60000,
  patiencePerDishMs: 15000,
  waiterSpeedMultiplier: 1,
  chefSpeedMultiplier: 1,
  waiterCarryCapacity: 1,
  collectPaymentsAtTable: false,
  maxGuests: Number.POSITIVE_INFINITY,
};

interface WaiterDeliveryPlan {
  orderIds: string[];
  nextIndex: number;
  /** "to-counter": plates not yet picked up; "to-table": carrying plates. */
  phase: "to-counter" | "to-table";
}

export interface SimulationMetrics {
  elapsedMs: number;
  servedOrders: number;
  averageWaitMs: number;
  /** Busy time / available staff time over the run (0..1). */
  chefUtilization: number;
  waiterUtilization: number;
  /** Occupied seat-time / total seat-time over the run (0..1). */
  tableUtilization: number;
}

export interface SimulationSnapshot {
  metrics: SimulationMetrics;
  timeMs: number;
  money: number;
  guestsServed: number;
  guestsLost: number;
  spawned: number;
  activeGuests: Array<{ id: string; state: SimCustomerState; seatIndex: number; waitedMs: number; patienceMs: number }>;
  orders: Array<{ id: string; guestId: string; state: Order["state"] }>;
  staff: Array<{ id: string; role: string; task: StaffTask["kind"] | "idle" }>;
  dirtySeats: number[];
}

export class RestaurantSimulation {
  readonly config: SimConfigResolved;
  readonly clock = new ManualClock(0);
  readonly economy: EconomySystem;
  readonly events: EventBus;
  readonly orders = new OrderQueue();
  private readonly reservations = new TaskReservationRegistry();
  private readonly random: RandomSource;
  private readonly customers: CustomerSystem;
  private readonly stations: CookingStation[];
  private readonly guestList: SimCustomer[] = [];
  private readonly staffList: SimStaff[] = [];
  private readonly deliveryPlans = new Map<string, WaiterDeliveryPlan>();
  private readonly dirtySeats = new Set<number>();
  private readonly seatOccupancy = new Map<number, string>();
  private nextSpawnAt = 500;
  private servedCount = 0;
  private totalWaitMs = 0;
  private waitSamples = 0;
  private elapsedMs = 0;
  private chefBusyMs = 0;
  private waiterBusyMs = 0;
  private seatOccupiedMs = 0;
  private lostCount = 0;
  private spawnedCount = 0;

  constructor(
    config: SimulationConfig,
    options: { economy?: EconomySystem; random?: RandomSource; events?: EventBus } = {},
  ) {
    const resolved = {
      ...defaults,
      ...config,
      stations: config.stations.map((station) => ({
        id: station.id,
        slotCount: station.slotCount,
        speedMultiplier: station.speedMultiplier ?? 1,
      })),
    } as SimConfigResolved;
    const effects = config.effects;
    if (effects) {
      resolved.chefSpeedMultiplier *= effects.chefCookMultiplier;
      resolved.waiterSpeedMultiplier *= effects.waiterSpeedMultiplier;
      resolved.waiterCarryCapacity = Math.max(resolved.waiterCarryCapacity, effects.waiterCarryCapacity);
      resolved.spawnIntervalMs = Math.max(200, Math.round(resolved.spawnIntervalMs / effects.spawnRateMultiplier));
      resolved.patienceBaseMs += effects.patienceBonusSeconds * 1000;
    }
    this.config = resolved;
    this.random = options.random ?? defaultRandomSource();
    this.economy = options.economy ?? new EconomySystem(0, this.clock);
    this.events = options.events ?? new EventBus();
    this.customers = new CustomerSystem(this.random);
    this.stations = this.config.stations.map((station) =>
      new CookingStation(station.id, station.slotCount, 1, station.speedMultiplier),
    );
    for (let index = 0; index < this.config.chefCount; index += 1) {
      this.staffList.push(createSimStaff(`chef-${index}`, "chef"));
    }
    for (let index = 0; index < this.config.waiterCount; index += 1) {
      this.staffList.push(createSimStaff(`waiter-${index}`, "waiter"));
    }
  }

  get timeMs(): number {
    return this.clock.now();
  }

  get served(): number {
    return this.servedCount;
  }

  get lost(): number {
    return this.lostCount;
  }

  get money(): number {
    return this.economy.getMoney();
  }

  get spawned(): number {
    return this.spawnedCount;
  }

  get openSeats(): number {
    return this.config.seatCount - this.seatOccupancy.size;
  }

  /** Advance the whole simulation by one fixed step. */
  step(deltaMs: number): void {
    const now = this.clock.now();
    this.elapsedMs += deltaMs;
    for (const staff of this.staffList) {
      if (!staff.task) {
        continue;
      }
      if (staff.role === "chef") {
        this.chefBusyMs += deltaMs;
      } else if (staff.role === "waiter") {
        this.waiterBusyMs += deltaMs;
      }
    }
    this.seatOccupiedMs += this.seatOccupancy.size * deltaMs;
    this.tickStaff(deltaMs);
    this.tickStations(deltaMs);
    this.tickGuests(deltaMs, now);
    this.spawnTick(now);
    this.sweepReservations();
    this.clock.advance(deltaMs);
  }

  /** Advance in fixed steps until `predicate` passes or the budget runs out. */
  runFor(durationMs: number, stepMs = 100): void {
    const target = this.clock.now() + durationMs;
    while (this.clock.now() < target) {
      this.step(stepMs);
    }
  }

  runUntil(predicate: () => boolean, timeoutMs: number, stepMs = 100): boolean {
    const deadline = this.clock.now() + timeoutMs;
    while (!predicate() && this.clock.now() < deadline) {
      this.step(stepMs);
    }
    return predicate();
  }

  /** True once the spawn cap was reached and every guest finished (served or safely left). */
  everyoneFinished(): boolean {
    return (
      this.spawnedCount > 0 &&
      this.spawnedCount >= this.config.maxGuests &&
      this.guestList.every((guest) => guest.state === "done")
    );
  }

  /** Orders currently carried by a waiter mid-delivery (debug + scene parity). */
  getCarriedOrderIds(staffId: string): string[] {
    const plan = this.deliveryPlans.get(staffId);
    return plan ? plan.orderIds.slice(plan.nextIndex) : [];
  }

  /** Rolling balance metrics for the M8 instrumentation pass (plan §53). */
  getMetrics(): SimulationMetrics {
    const chefCount = this.staffList.filter((staff) => staff.role === "chef").length;
    const waiterCount = this.staffList.filter((staff) => staff.role === "waiter").length;
    return {
      elapsedMs: this.elapsedMs,
      servedOrders: this.waitSamples,
      averageWaitMs: this.waitSamples === 0 ? 0 : Math.round(this.totalWaitMs / this.waitSamples),
      chefUtilization: chefCount === 0 || this.elapsedMs === 0 ? 0 : this.chefBusyMs / (chefCount * this.elapsedMs),
      waiterUtilization: waiterCount === 0 || this.elapsedMs === 0 ? 0 : this.waiterBusyMs / (waiterCount * this.elapsedMs),
      tableUtilization: this.config.seatCount === 0 || this.elapsedMs === 0 ? 0 : this.seatOccupiedMs / (this.config.seatCount * this.elapsedMs),
    };
  }

  snapshot(): SimulationSnapshot {
    return {
      metrics: this.getMetrics(),
      timeMs: this.clock.now(),
      money: this.economy.getMoney(),
      guestsServed: this.servedCount,
      guestsLost: this.lostCount,
      spawned: this.spawnedCount,
      activeGuests: this.guestList
        .filter((guest) => guest.state !== "done")
        .map((guest) => ({
          id: guest.id,
          state: guest.state,
          seatIndex: guest.seatIndex,
          waitedMs: Math.round(guest.waitedMs),
          patienceMs: guest.patienceMs,
        })),
      orders: this.orders.all().map((order) => ({ id: order.id, guestId: order.guestId, state: order.state })),
      staff: this.staffList.map((staff) => ({
        id: staff.id,
        role: staff.role,
        task: staff.task?.kind ?? "idle",
      })),
      dirtySeats: [...this.dirtySeats].sort((a, b) => a - b),
    };
  }

  // --- spawning -------------------------------------------------------------

  private spawnTick(now: number): void {
    if (now < this.nextSpawnAt || this.spawnedCount >= this.config.maxGuests) {
      return;
    }
    const freeSeat = this.findFreeSeat();
    if (freeSeat === null) {
      this.nextSpawnAt = now + Math.max(250, Math.round(this.config.spawnIntervalMs * 0.25));
      return;
    }
    this.spawnGuest(freeSeat, now);
    const jitter = 0.75 + this.random.next() * 0.5;
    this.nextSpawnAt = now + Math.round(this.config.spawnIntervalMs * jitter);
  }

  private findFreeSeat(): number | null {
    for (let seat = 0; seat < this.config.seatCount; seat += 1) {
      if (!this.seatOccupancy.has(seat)) {
        return seat;
      }
    }
    return null;
  }

  private spawnGuest(seatIndex: number, now: number): void {
    const guestId = createGuestId();
    this.seatOccupancy.set(seatIndex, guestId);
    this.spawnedCount += 1;
    this.guestList.push({
      id: guestId,
      state: "entering",
      archetypeId: this.customers.rollCustomerArchetype().id,
      seatIndex,
      orderRecipeIds: [],
      waitedMs: 0,
      patienceMs: 0,
      stateSince: now,
      servedValue: 0,
    });
    this.events.emit("customer-arrived", { guestId });
  }

  // --- guests -----------------------------------------------------------------

  private setGuestState(guest: SimCustomer, to: SimCustomerState, now: number): void {
    if (!canTransitionCustomerState(guest.state, to)) {
      throw new Error(`illegal customer transition ${guest.state} -> ${to} (guest ${guest.id})`);
    }
    guest.state = to;
    guest.stateSince = now;
  }

  private tickGuests(deltaMs: number, now: number): void {
    for (const guest of [...this.guestList]) {
      if (isHungryState(guest.state)) {
        guest.waitedMs += deltaMs;
        if (guest.waitedMs > guest.patienceMs) {
          this.guestGivesUp(guest, now);
          continue;
        }
      }

      const dwell = now - guest.stateSince;
      switch (guest.state) {
        case "entering":
          if (dwell >= this.config.walkEnterToSeatMs) {
            this.setGuestState(guest, "walking-to-seat", now);
            this.setGuestState(guest, "ordering", now);
            this.placeOrders(guest, now);
          }
          break;
        case "waiting-for-food": {
          const pending = this.orders
            .forGuest(guest.id)
            .filter((order) => order.state === "queued" || order.state === "cooking" || order.state === "ready");
          if (pending.length === 0 && guest.orderRecipeIds.length > 0) {
            this.setGuestState(guest, "eating", now);
          }
          break;
        }
        case "eating":
          if (dwell >= this.config.eatMs * getCustomerArchetype(guest.archetypeId).eatingTimeMultiplier) {
            if (this.config.collectPaymentsAtTable) {
              this.setGuestState(guest, "waiting-for-payment", now);
            } else {
              this.setGuestState(guest, "walking-to-counter", now);
            }
          }
          break;
        case "walking-to-counter":
          if (dwell >= this.config.walkToCounterMs) {
            this.setGuestState(guest, "paying", now);
          }
          break;
        case "paying":
          if (dwell >= this.config.payMs) {
            this.completePayment(guest, now);
          }
          break;
        case "leaving":
        case "leaving-angry":
          if (dwell >= this.config.walkExitMs) {
            this.setGuestState(guest, "done", now);
            this.expireGuestOrders(guest);
          }
          break;
        default:
          break;
      }
    }
  }

  private placeOrders(guest: SimCustomer, now: number): void {
    const archetype = getCustomerArchetype(guest.archetypeId);
    const chosen = this.customers
      .composeArchetypeOrder(archetype, this.config.menu, 5, undefined)
      .slice(0, Math.max(this.config.maxOrdersPerGuest, archetype.minOrderItems));
    for (const recipe of chosen) {
      const order: Order = {
        id: createTicketId(),
        guestId: guest.id,
        recipe,
        state: "queued",
        createdAt: now,
      };
      this.orders.add(order);
      guest.orderRecipeIds.push(recipe.id);
      this.events.emit("order-created", { ticketId: order.id, guestId: guest.id, recipeId: recipe.id });
    }
    guest.patienceMs = Math.round(
      computePatienceMs(chosen, this.config.patienceBaseMs, this.config.patiencePerDishMs) *
        archetype.patienceMultiplier,
    );
    this.setGuestState(guest, "waiting-for-food", now);
  }

  private completePayment(guest: SimCustomer, now: number): void {
    const archetype = getCustomerArchetype(guest.archetypeId);
    const bill = Math.round(guest.servedValue * archetype.orderValueMultiplier);
    const effects = this.config.effects;
    const tipChance = (effects?.tipChance ?? 0) + archetype.tipChanceBonus;
    const tip =
      tipChance > 0 && bill > 0 && this.random.next() < tipChance
        ? Math.max(1, Math.round(bill * (effects?.tipMultiplier ?? 0)))
        : 0;
    if (bill + tip > 0) {
      this.economy.earnMoney(bill + tip, "payment");
    }
    this.events.emit("customer-paid", { guestId: guest.id, amount: bill + tip, tip });
    this.servedCount += 1;
    this.customers.recordServed();
    this.releaseSeat(guest);
    this.setGuestState(guest, "leaving", now);
  }

  private guestGivesUp(guest: SimCustomer, now: number): void {
    for (const order of this.orders.forGuest(guest.id)) {
      if (!isTerminalOrderState(order.state)) {
        order.state = "cancelled";
        for (const station of this.stations) {
          station.cancel(order.id);
        }
        this.events.emit("order-cancelled", { ticketId: order.id, reason: "customer-impatience" });
      }
    }
    this.lostCount += 1;
    this.customers.recordLost();
    this.releaseSeat(guest);
    this.setGuestState(guest, "leaving-angry", now);
  }

  private releaseSeat(guest: SimCustomer): void {
    this.seatOccupancy.delete(guest.seatIndex);
    this.dirtySeats.add(guest.seatIndex);
  }

  private expireGuestOrders(guest: SimCustomer): void {
    for (const order of this.orders.forGuest(guest.id)) {
      if (order.state === "served") {
        order.state = "completed";
      }
    }
  }

  // --- chefs / stations ---------------------------------------------------------

  private tickStations(deltaMs: number): void {
    for (const station of this.stations) {
      for (const finishedId of station.tick(deltaMs)) {
        const order = this.orders.get(finishedId);
        if (!order || order.state === "cancelled") {
          continue;
        }
        order.state = "ready";
        order.readyAt = this.clock.now();
        // Chef reservation ends at the pass; waiters claim from here (§21).
        this.reservations.releaseTarget({ type: "order", id: order.id });
        this.events.emit("order-ready", { ticketId: order.id, recipeId: order.recipe.id });
      }
    }
  }

  private tickStaff(deltaMs: number): void {
    for (const staff of this.staffList) {
      if (staff.task === null) {
        staff.totalIdleMs += deltaMs;
        this.selectTask(staff);
        continue;
      }
      staff.totalWorkMs += deltaMs;
      staff.busyUntilElapsed -= deltaMs;
      if (staff.busyUntilElapsed > 0) {
        continue;
      }
      if (staff.task.kind === "cook") {
        staff.task = null;
        continue;
      }
      this.finishWaiterStep(staff);
    }
  }

  private selectTask(staff: SimStaff): void {
    if (staff.role === "chef") {
      this.selectChefTask(staff);
    } else {
      this.selectWaiterTask(staff);
    }
  }

  private selectChefTask(chef: SimStaff): void {
    for (const order of this.orders.queuedOrders()) {
      // Oldest order first (§19); reservation prevents double cooking (§21).
      if (!this.reservations.reserve(chef.id, { type: "order", id: order.id })) {
        continue;
      }
      const target = this.stations.find((station) => station.freeSlotIndex() !== null);
      const slotIndex = target ? (target.freeSlotIndex() as number) : null;
      if (!target || slotIndex === null) {
        this.reservations.release(chef.id, { type: "order", id: order.id });
        return;
      }
      const baseCookMs = order.recipe.preparationTimeSeconds * 1000;
      const chefCookMs = Math.max(50, baseCookMs / this.config.chefSpeedMultiplier);
      target.start(order.id, chefCookMs, slotIndex);
      order.state = "cooking";
      order.cookingStartedAt = this.clock.now();
      chef.task = { kind: "cook", orderId: order.id, stationId: target.state.id };
      // Station multiplier 1 + chef multiplier keeps these clocks in lockstep;
      // station upgrades (M4) intentionally extend the dish clock only.
      chef.busyUntilElapsed = chefCookMs;
      return;
    }
  }

  private selectWaiterTask(waiter: SimStaff): void {
    const plan = this.deliveryPlans.get(waiter.id);
    if (plan) {
      this.advanceDeliveryPlan(waiter, plan);
      return;
    }

    // Priority 1: deliver prepared food (§20), batching up to carry capacity.
    const claimed: string[] = [];
    for (const order of this.orders.readyOrders()) {
      if (claimed.length >= this.config.waiterCarryCapacity) {
        break;
      }
      if (this.reservations.reserve(waiter.id, { type: "order", id: order.id })) {
        claimed.push(order.id);
      }
    }
    if (claimed.length > 0) {
      const freshPlan: WaiterDeliveryPlan = { orderIds: claimed, nextIndex: 0, phase: "to-counter" };
      this.deliveryPlans.set(waiter.id, freshPlan);
      this.advanceDeliveryPlan(waiter, freshPlan);
      return;
    }

    if (this.config.collectPaymentsAtTable) {
      // Priority 2: collect payment from a waiting guest.
      const payable = this.guestList.find(
        (guest) =>
          guest.state === "waiting-for-payment" &&
          !this.reservations.isReserved({ type: "guest", id: guest.id }),
      );
      if (payable && this.reservations.reserve(waiter.id, { type: "guest", id: payable.id })) {
        waiter.task = { kind: "collect-payment", guestId: payable.id };
        waiter.busyUntilElapsed = this.legMs(this.config.walkWaiterLegMs + this.config.handoffMs);
        return;
      }
    }

    // Priority 3: clean tables.
    for (const seat of [...this.dirtySeats].sort((a, b) => a - b)) {
      const target = { type: "seat" as const, id: String(seat) };
      if (this.reservations.reserve(waiter.id, target)) {
        waiter.task = { kind: "clean-table", guestId: target.id };
        waiter.busyUntilElapsed = this.legMs(this.config.walkWaiterLegMs + this.config.cleanMs);
        return;
      }
    }
  }

  private advanceDeliveryPlan(waiter: SimStaff, plan: WaiterDeliveryPlan): void {
    const orderId = plan.orderIds[plan.nextIndex];
    if (!orderId) {
      this.deliveryPlans.delete(waiter.id);
      waiter.task = null;
      return;
    }
    waiter.task = { kind: "deliver", orderId };
    waiter.busyUntilElapsed =
      plan.phase === "to-counter"
        ? this.legMs(this.config.walkWaiterLegMs)
        : this.legMs(this.config.walkWaiterLegMs + this.config.handoffMs);
  }

  private finishWaiterStep(waiter: SimStaff): void {
    const task = waiter.task;
    if (!task) {
      return;
    }
    const now = this.clock.now();

    if (task.kind === "clean-table") {
      this.reservations.release(waiter.id, { type: "seat", id: task.guestId });
      this.dirtySeats.delete(Number(task.guestId));
      waiter.task = null;
      return;
    }

    if (task.kind === "collect-payment") {
      const guest = this.guestList.find((item) => item.id === task.guestId && item.state === "waiting-for-payment");
      this.reservations.release(waiter.id, { type: "guest", id: task.guestId });
      if (guest) {
        this.setGuestState(guest, "paying", now);
      }
      waiter.task = null;
      return;
    }

    const plan = this.deliveryPlans.get(waiter.id);
    const order = this.orders.get(task.orderId);
    if (!plan || !order || order.state !== "ready") {
      // Invalid task target: release and return to idle (§58).
      if (order?.state === "ready") {
        this.reservations.release(waiter.id, { type: "order", id: order.id });
      }
      if (plan) {
        for (const remaining of plan.orderIds.slice(plan.nextIndex)) {
          this.reservations.release(waiter.id, { type: "order", id: remaining });
        }
        this.deliveryPlans.delete(waiter.id);
      }
      waiter.task = null;
      return;
    }

    if (plan.phase === "to-counter") {
      // Leg just walked was the pickup trip; plates are now carried.
      plan.phase = "to-table";
      this.advanceDeliveryPlan(waiter, plan);
      return;
    }

    this.serveOrder(order);
    plan.nextIndex += 1;
    // Remaining plates stay carried: no return leg to the counter.
    if (plan.nextIndex >= plan.orderIds.length) {
      this.deliveryPlans.delete(waiter.id);
      waiter.task = null;
      return;
    }
    this.advanceDeliveryPlan(waiter, plan);
  }

  private serveOrder(order: Order): void {
    order.state = "served";
    order.servedAt = this.clock.now();
    this.totalWaitMs += order.servedAt - order.createdAt;
    this.waitSamples += 1;
    const guest = this.guestList.find((item) => item.id === order.guestId);
    if (guest) {
      guest.servedValue += order.recipe.sellPrice;
    }
    this.events.emit("order-served", { ticketId: order.id, guestId: order.guestId, recipeId: order.recipe.id });
  }

  // --- housekeeping -----------------------------------------------------------

  private sweepReservations(): void {
    const valid = new Set<string>();
    for (const order of this.orders.all()) {
      if (order.state === "queued" || order.state === "cooking" || order.state === "ready") {
        valid.add(`order:${order.id}`);
      }
    }
    if (this.config.collectPaymentsAtTable) {
      for (const guest of this.guestList) {
        if (guest.state === "waiting-for-payment") {
          valid.add(`guest:${guest.id}`);
        }
      }
    }
    for (const seat of this.dirtySeats) {
      valid.add(`seat:${seat}`);
    }
    this.reservations.prune(valid);

    for (const [waiterId, plan] of [...this.deliveryPlans.entries()]) {
      const remaining = plan.orderIds.slice(plan.nextIndex);
      const stillReady = remaining.filter((id) => this.orders.get(id)?.state === "ready");
      if (stillReady.length === 0 && !remaining.includes(plan.orderIds[plan.nextIndex])) {
        this.deliveryPlans.delete(waiterId);
      } else if (stillReady.length !== remaining.length) {
        plan.orderIds = [...plan.orderIds.slice(0, plan.nextIndex), ...stillReady];
      }
    }
  }

  private legMs(ms: number): number {
    return Math.max(50, Math.round(ms / this.config.waiterSpeedMultiplier));
  }
}
