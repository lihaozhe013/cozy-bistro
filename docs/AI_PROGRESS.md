# AI Development Progress

Journal of the autonomous agent executing `master_plan.md`.

## Current milestone

Milestones 0-9 complete. Remaining per plan: M10 asset polish (needs human
art direction) and M11 release hardening; both start with a human playtest.

## Completed

- **M0 Repository audit** (2026-09-17): inspected both projects, ran install +
  build, mapped working/partial/dead code. Wrote `docs/CURRENT_STATE.md`.
  - Key finding: root 2D Phaser game already implements most of the plan's MVP
    (customer loop, staff automation, expansions, save slots, offline progress)
    but has **zero tests**, no save versioning, no event bus, and simulation
    state locked inside a 14k-line `GameScene.ts`.
  - Scope decision: the plan targets the **root 2D project**; `v2/` (3D/
    SpacetimeDB multiplayer) is out of scope and untouched (plan §93 keeps
    Phaser; plan §7/§68 defer multiplayer). Recorded in CURRENT_STATE.md.
  - `src/data/customers.ts` and `src/data/upgrades.ts` are dead code.

## Completed (continued)

- **M1 Core architecture stabilization** (2026-09-17):
  - vitest wired up: `pnpm test` / `pnpm run typecheck` scripts; 64 tests in
    7 files cover economy, cooking/menu/pantry, customer orders (seeded RNG),
    staff payroll/hiring, day cycle/rent, reputation, placement rules,
    save round-trip/migration/quarantine, and simulation primitives.
  - `src/simulation/`: RandomSource+SeededRandom, GameClock
    (Wall/Manual/Scene), EntityIds, typed EventBus + shared `gameEvents`.
  - De-Phaser'd CustomerSystem/CookingSystem/ReputationSystem/
    FurniturePlacementSystem/EconomySystem (clock injectable) so node tests
    run without a browser; behavior-preserving (same distributions/formulas).
  - Save format is versioned (`CURRENT_SAVE_VERSION = 1`); `migrateSave`
    validates + normalizes + drops orphan tickets; corrupt payloads are
    quarantined to `*-corrupt-<ts>` keys, never deleted; legacy versionless
    saves and the pre-slot key still load.
  - `src/data/balance.ts`: 60+ gameplay constants moved out of GameScene
    verbatim; `src/data/contentValidation.ts` runs at scene create (§79).
  - Gameplay events emitted from the scene: customer-arrived, order-created/
    ready/served, customer-paid, money-earned, upgrade-purchased,
    area-unlocked, staff-hired (9 call sites).
  - Verified: build green, `tsc` clean, 64/64 tests pass, headless-Chrome
    smoke boot of production build shows Phaser WebGL boot with no console
    errors.

- **M2/M3 Service loop + staff automation** (2026-09-17, headless engine):
  - `src/simulation/RestaurantSimulation.ts`: deterministic engine mirroring
    the scene's rules — customer FSM with legal-transition guard (§12),
    patience + safe angry-exit cancellation (§13/§58), order queue with
    oldest-first chef policy (§15/§19), stations with parallel slots (§17),
    waiter task priorities deliver > payment > clean (§20), batch carry
    capacity trips, and a TaskReservationRegistry preventing duplicate claims (§21).
  - New submodules: `simulation/orders/Order.ts`, `simulation/customer/CustomerLogic.ts`,
    `simulation/staff/StaffTasks.ts`, `simulation/cooking/CookingStation.ts`.
  - M2 acceptance proven by tests: 20 sequential customers all complete;
    no stuck tables (seats drain), no duplicate orders (serve-once audit),
    no staff deadlock (all idle at rest, revenue == Σ prices).
  - M3 behaviors proven: two waiters never serve the same order; carry=2
    batches plates in one trip; chef serves oldest queued first; waiter
    speed upgrades raise throughput; table-payment routing works.
  - Test-driven engine fix: delivery plans had a phase bug (pickup leg and
    table leg off by one — dishes were "served" from the counter). Now
    modeled as explicit to-counter/to-table phases.

- **M4 Economy & upgrades** (2026-09-17):
  - `src/data/upgrades.ts` (was dead code) rewritten: 10 data-driven
    definitions with exponential cost curves (growth 1.55–2.3) covering chef
    cook speed, waiter move speed, waiter carry capacity, customer flow,
    guest patience, tip chance/amount, dish satisfaction, dishwasher speed,
    and marketing glow; `computeUpgradeEffects()` compiles levels to one
    runtime bundle; `describeUpgradeEffect()` feeds the UI (§35).
  - `src/simulation/progression/UpgradeSystem.ts`: purchases strictly through
    EconomySystem, emits `upgrade-purchased`, hydrates defensively.
  - Scene wiring: cook timers, dishwasher, staff walk speed, spawn interval,
    patience, satisfaction, and tips all read live effects; purchases persist
    via `upgradeLevels` (save field + migration + round-trip test).
  - New "Upgrades" ops button + modal listing Lv, current->next effect, cost.
  - `RestaurantSimulation` accepts `effects` so upgraded configs are tested
    headlessly (chef speed, patience, carry through real runs).
  - Fixed a self-recursion introduced during wiring (caught by headless boot
    smoke: Maximum call stack exceeded).

- **M5 Expansion** (2026-09-17): the scene's 8-area expansion system is now
  a pure spec: `src/data/expansions.ts` (areas/cells/signs) +
  `src/simulation/progression/Expansion.ts` (cost curve, sequential purchase,
  luxury-tier mapping, overlap audit). Scene delegates; geometry verified
  disjoint by tests; validation runs at startup.
- **M6 Customer types** (2026-09-17): `src/data/customers.ts` (was dead code)
  now defines the 3 planned archetypes (Regular/Foodie/Family) with weights,
  patience/eating/value multipliers, order-size ranges, and tip bonuses.
  Wired into BOTH the headless sim (rolls, order composition, patience,
  eat duration, bill multiplier, tips) and the live scene (guest objects carry
  `archetypeId`; patience, eating, payment, tip chance scale by archetype;
  archetype persists through saves incl. migration validation).
  - Content validation extended: duplicate curves/levels, expansion geometry,
    archetype sanity.
  - Tests: weight ordering, family > regular order size, distinct dishes,
    tier mapping, purchase sequence rejection, non-overlap audit. 95 tests
    green; production build boots headless without console errors.
  - Recipes (36+ across 5 tiers), stove/counter station variants, 10
    upgrades: already satisfied by existing content; M6 checklist complete.

- **M7 Juice pass** (2026-09-17):
  - `FeedbackSystem` (world + UI layers): reusable floating text (money/rep/
    level/info tones), scale bounces, and texture-free burst particles; all
    tween-managed lifetimes.
  - `AudioSystem`: zero-asset WebAudio synth SFX (coin, upgrade, unlock,
    ready, click) unlocked on first gesture; M mutes, volume persisted in
    localStorage (device-level setting kept out of gameplay saves).
  - Scene subscribes to gameEvents: +$N/tip floats at payers, "Ready!" at
    stoves, LEVEL/banner floats + bursts on upgrades and area unlocks, staff
    join float, button click SFX; all subscriptions unsubscribed on scene
    shutdown so slot reloads cannot double-fire.
  - Boot smoke: clean Phaser 4 WebGL boot, zero uncaught errors with all
    handlers live (full visual verification is manual — headless Chrome
    cannot observe canvas pixels; flagged under Known issues).

- **M8 partial: instrumentation** (2026-09-17):
  - F2 toggles a multi-line debug overlay (plan §53): FPS, guests, jobs,
    tweens/timers, revenue/min, guests-min, served/lost-min, kitchen queue
    length + pressure age (new per-ticket createdAt), dirty seats, live
    chef/waiter task lists, money, upgrade levels, day, rating, draw/save/
    path timings, save size and version.
  - Simulation speed (§54): deliberately NOT half-implemented. The scene mixes
    Phaser tweens + delayedCalls + delta accumulation; a partial scale would
    desync chef cook clocks from movement tweens. Deferred until the scene
    consumes the shared RestaurantSimulation clocks (M3 parity extraction).
  - Pacing targets (§50/§85) can only be validated by live playtests;
    the headless sim uses representative but not scene-identical timings —
    recorded in BALANCE.md rather than asserted from the sim.

## Next

- M2/M3: extract ticket/customer/staff state machines from `GameScene.ts` into
  `src/simulation/` incrementally; headless 20-customer acceptance sim.
- M4: data-driven upgrade definitions + in-game upgrade panel.
- M6: wire real customer archetypes (Regular/Foodie/Family).
- M7: floating-text feedback system + audio.

## Important architectural decisions

1. **Plan executes against root 2D game, not v2** (see CURRENT_STATE.md scope
   decision). Preserve v2 as-is.
2. **Incremental extraction over rewrite** (plan §94): pure system classes stay;
   Phaser-coupled scene logic gets pulled out behind tests, never speculatively.
3. **Injectable `RandomSource`** replaces direct `Phaser.Math`/`Utils.Array`
   calls in systems so tests are deterministic (plan §57); default source
   preserves current distribution.
4. **Save format**: existing `SaveGameState` keys preserved verbatim; a
   `version` field is added with v0 (legacy, versionless) → v1 migration.
   Corrupt saves are backed up (`*-corrupt-<ts>`) instead of deleted (plan §58).
5. Tests run on `vitest` (node env) importing `src/systems` + `src/simulation`
   directly — no Phaser boot (plan §56).

## Known issues

- Headless smoke checks only page boot/console; floating-text visuals and
  SFX need a human eyeball/ear pass at `pnpm dev` (agent cannot verify pixels).

- `GameScene.ts` size violates plan §76; extraction is multi-session work.
- Phaser config runs at 30 FPS (`forceSetTimeOut`); evaluate 60 FPS later
  (performance pass, plan §59).
- Duplicate tuning paths: `AdminSettings` overrides vs hardcoded defaults.
  `balance.ts` will become single source; admin settings stay as overrides.

## Balance notes

- Starter money 520, hire costs 80/70/65, expansion base 5000 × 2^n,
  recipe upgrade cost level² ingredients/ingredient (pre-existing values;
  will move to `balance.ts` unchanged, then tune in M8).
