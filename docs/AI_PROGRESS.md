# AI Development Progress

Journal of the autonomous agent executing `master_plan.md`.

## Current milestone

Milestone 2 — Complete customer service loop (verification + headless sim).

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

## In progress

- M2: acceptance-grade headless customer-loop simulation proving the existing
  loop under spawn pressure; fixing whatever stalls surfaces.

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

- `GameScene.ts` size violates plan §76; extraction is multi-session work.
- Phaser config runs at 30 FPS (`forceSetTimeOut`); evaluate 60 FPS later
  (performance pass, plan §59).
- Duplicate tuning paths: `AdminSettings` overrides vs hardcoded defaults.
  `balance.ts` will become single source; admin settings stay as overrides.

## Balance notes

- Starter money 520, hire costs 80/70/65, expansion base 5000 × 2^n,
  recipe upgrade cost level² ingredients/ingredient (pre-existing values;
  will move to `balance.ts` unchanged, then tune in M8).
