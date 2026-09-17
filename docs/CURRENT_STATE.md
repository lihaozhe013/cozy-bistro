# Current State — Repository Audit (Milestone 0)

Audit date: 2026-09-17. Audited by the autonomous implementation agent executing
`master_plan.md`.

## Scope decision: which project does the master plan target?

The repository contains **two games**:

1. **Root `src/` — 2D Phaser game ("classic")**. This is what `master_plan.md`
   describes: it names `GameScene.ts`, `src/systems/*` (RestaurantGrid,
   FurniturePlacement, Cooking, Customer, Economy, Reputation, DayCycle, Save),
   Phaser sprites, localStorage saves, "Do not replace Phaser" (§93), and
   "no premature multiplayer" (§0/§7). All of these match the root project exactly.
2. **`v2/` — 3D Three.js + SpacetimeDB multiplayer rewrite** (~90k lines, last
   feature work 2026-08-12). It has its own `MIGRATION_PLAN.md` / `PHASE_I_PLAN.md`.
   The master plan explicitly de-prioritizes multiplayer and backends (§7, §68–§71).

**Decision (per master_plan §1.1 / §100):** the master plan is executed against the
**root 2D Phaser project**. `v2/` is an unrelated experimental track and is **not
touched**. `vite.config.ts` notes the 2D game is "PARKED" at `/classic/` — the plan
revives it as the primary cozy single-player product; this decision is recorded here
and in `AI_PROGRESS.md`.

## Build / tooling health

| Check | Result |
| --- | --- |
| `pnpm install` | OK (pnpm workspace; v2 is a member) |
| `pnpm run build` (`tsc && vite build`) | OK, ~0.7s; chunk-size warning only |
| `npm test` / `vitest` | **Absent — no test framework exists** |
| Lint / typecheck script | None (typecheck is implicit via `tsc` in build) |
| Runtime | Vite dev server + Phaser 4.2 (`AUTO`, FIT scale, 1600×900, 30 FPS target) |

## Working features (verified in code; README confirms play-tested flows)

- **Restaurant & grid**: isometric room, camera pan/zoom (0.34–3x), rotation steps,
  street/inside view, room shell, walls/flooring categories.
- **Furniture**: place / move / rotate / remove with refund, collision + occupancy
  validation, chair-table pairing into `DiningSeat`s, decoration score &
  attractiveness, luxury tiers 1–5 gating placement.
- **Economy** (`EconomySystem`): single money source, canAfford/spend/earn,
  daily revenue/expenses, capped transaction log (5k), payroll, rent, refunds.
- **Staff** (`StaffSystem` + scene): hire/fire chef/waiter/errand with
  pending-firing queue (leave after current task), chef-to-station sync with
  `cookingSlots`, waiter task priorities (payment / ready food / cleaning),
  errand shopping, dishwasher tick, task reservations + stall recovery
  (`recoverStalledOrderHandoffs/FoodDeliveries/OrphanedServiceTickets/
  GuestPayments/CleaningReservations` on a periodic check).
- **Customers** (`CustomerSystem` + scene): enter → seat → expectation roll →
  order 1–4 dishes by category → kitchen ticket queue (`ordering|queued|cooking|
  ready|serving|delivered`) → eat → pay at counter → leave; patience timers,
  ratings recorded to `ReputationSystem`, daily served/lost counters.
- **Progression**: day cycle + rent (`DayCycleSystem`), reputation/rating history,
  8 expansion levels with cost curve (`firstExpansionCost * multiplier^n`),
  expansion sign overlays with price + confirm modal, tier unlocks tied to
  expansion level, menu management (max 3 active recipes per category),
  per-recipe upgrade levels 1–10 paid **in ingredients** (level² per ingredient).
- **Save** (`SaveSystem`): 3 slots + legacy key, autosave ("quiet save"), manual
  S key, save modal with metadata, repair-current-save, new-game reset,
  in-flight state persisted (guests, tickets, staff actor positions, trash).
- **Offline progress**: elapsed-time estimate capped, offline served/revenue
  estimate, offline shopping, "welcome back" summary message.
- **Presentation**: AI-generated atlases (characters/furniture/environment/
  ui-icons) via `scripts/generate_atlases.py`; sprite characters with 8-facing
  + sit variants; speech bubbles; cooking flame; rating widget; debug text
  overlay with update-error capture; pavement pedestrians/trash side mechanic.

## Post-M1..M6 status (updated 2026-09-17)

Tests exist (vitest, 95 passing), saves are versioned/migrated/quarantined,
event bus live, balance centralized, upgrade system live (10 data-driven),
customer archetypes live (Regular/Foodie/Family), expansion rules extracted
pure. Remaining gaps: scene still 14k lines (M2/M3 logic duplicated as
headless spec rather than shared yet), juice pass (M7), FPS 30 (M8), audio,
offline model tuning. Original gap list below kept for the audit trail.

## Partially working / gaps vs. master plan

| Plan requirement | Status |
| --- | --- |
| §56 automated tests | **Missing entirely** (only `scripts/simulate-full-process.mjs`, an ad-hoc headless economy sim) |
| §9/§98 simulation ⟂ rendering separation | `Economy/Cooking/Staff/Customer/Reputation/DayCycle/Grid/Placement` are classes, **but customer/staff/ticket state machines live inside GameScene** and hold Phaser containers; not testable without Phaser |
| §33 event bus | Missing |
| §11 game clock abstraction | Missing (scene `time` + scattered `Date.now()`) |
| §43/§44 versioned save + migration | `SaveGameState` has **no `version` field**; load = raw `JSON.parse`, corrupt = silently deleted |
| §25/§26 data-driven upgrade definitions | `src/data/upgrades.ts` is **dead code** (1 entry, never imported); no chef/waiter/restaurant upgrades in game |
| §77 centralized balance config | Constants scattered in GameScene lines ~320–400 (gameplay subset), admin settings partly override some |
| §57 injectable RNG | Systems call `Phaser.Math.Between` / `Phaser.Utils.Array.GetRandom` directly |
| §14 customer types (Regular/Foodie/Family) | `src/data/customers.ts` is **dead code** (2 archetypes, never imported) |
| §31/§32 floating money text / feedback juice | Partial (bubbles, flame, hearts absent; no reusable floating-text API) |
| §53 debug overlay F2 | Debug text exists; confirm toggle + sim-speed controls |
| §54 simulation speed control | Missing |

## Broken / suspicious

- No crash-level defects found by static audit; `update()` is wrapped in a
  try/catch that surfaces errors on the debug overlay (good §58 posture).
- `Phaser.Math.RND.uuid()` used for furniture uids — Phaser RNG-dependent, not
  save-stable-friendly (§10 wants our own IDs).
- Dead modules (`data/customers.ts`, `data/upgrades.ts`) risk confusion.
- `main.ts` ends with unused `game` variable assignment only in dev; fine.

## Important technical debt

1. **`GameScene.ts` is 14,122 lines / ~700 methods** (plan §76 scene-size rule).
   Extraction must be incremental; start by pulling pure logic (spawn interval
   math, price formulas, ticket transitions) into `src/simulation/`.
2. **30 FPS fixed target with `forceSetTimeOut`** — plan wants 60 FPS feel.
3. No test infrastructure → everything below it is unverifiable.

## Recommended reuse (do NOT rewrite)

- All `src/systems/*` classes (small, mostly pure) → keep, add injectable RNG.
- `SaveSystem` slots/legacy-key behavior → keep, wrap with version + migration.
- `components/types.ts` save shape → keep field names; add `version` + normalize.
- Offline estimate + recovery functions → extract into pure functions + tests.
- Data files (`furniture.ts` 1.3k lines, `recipes.ts` 619 lines) → keep; add
  startup validation (plan §79) instead of restructuring.

## Milestone readiness verdict

The MVP loop (plan §6) is **already implemented** in the 2D game, roughly
matching Milestones 2/3/5/9 in spirit but **untested and render-coupled**.
Correct execution order for this repo:

- **M1**: tooling (vitest), save versioning + migration + validation, event bus,
  clock/RNG abstractions, central `balance.ts`, de-Phaser the pure systems.
- **M2/M3**: extract customer/staff/ticket logic from GameScene into
  `src/simulation/` incrementally, with the 20-customer and no-deadlock
  acceptance tests expressed as deterministic headless sims.
- **M4**: real data-driven upgrade definitions (chef speed, waiter speed/carry,
  spawn rate, table cap…) + upgrade panel wiring.
- **M6/M7**: revive `customers.ts` as real types, floating text + audio polish.
