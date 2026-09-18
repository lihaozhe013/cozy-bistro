# Cozy Bistro Specification

Status: living product and engineering specification  
Last reviewed: 2026-09-18

This is the source of truth for continued development of the root `src/` game.
It records the current product direction, the behavior that already exists, and
the constraints that future changes must respect. It supersedes the old
autonomous plan; that plan is no longer part of the working tree or the active
development process.

When an old note, an upstream assumption, and this document disagree, use this
document plus the running code and tests. Update this document when a product
decision changes.

## 1. Scope and project tracks

The root game is an original private game project. It does not promise
compatibility with an upstream game, its content, its backend, or its future
feature direction.

## 2. Product identity

Cozy Bistro is a cozy 2D restaurant-management and light idle-tycoon game for
private play.

- Primary platform: desktop browser; mobile browser remains a design
  consideration.
- Primary interaction: mouse and touch; keyboard is for shortcuts, not movement.
- Player role: restaurant manager and layout planner.
- Staff and customers: autonomous actors that make the restaurant feel alive.
- Business model: none. No ads, premium currency, loot boxes, battle pass, or
  competitive anti-cheat system.
- Identity: original names, data, visuals, and mechanics. Genre inspiration is
  acceptable; copied assets and exact reproduction of another game are not.

The target feeling is: “I built this machine, and now it runs beautifully.”
The player should regularly see customers arrive, food move through the
kitchen, staff solve bottlenecks, money appear, and the restaurant visibly
improve.

## 3. Player experience

### Core loop

```text
arrive → find a seat → order → cook → deliver → eat → pay → clean
       → earn money → improve the restaurant → serve more guests
```

The loop must remain understandable from the world view, not only from panels.
Upgrades should solve visible operational problems: slow cooking, long walking
trips, insufficient carrying capacity, dirty tables, low customer flow, or
limited space.

### Design pillars

1. **Cozy autonomy** — the restaurant is pleasant to watch and does not demand
   constant clicking.
2. **Visible progression** — furniture, expansion areas, staff, recipes, and
   operational upgrades change what the player sees and can do.
3. **Gentle pressure** — patience and bottlenecks create decisions without
   making the game punitive.
4. **Readable systems** — a small number of strong modifiers is preferable to
   opaque simulation complexity.
5. **Fast iteration** — content is data-driven and gameplay rules can be tested
   without booting Phaser.

## 4. Implemented baseline

The root game already provides the following playable baseline:

- Isometric/top-down restaurant with street, facade, entrance, dining areas,
  kitchen areas, camera pan/zoom/rotation, and visible expansion signs.
- Furniture placement, movement, rotation, removal, collision/occupancy checks,
  table-chair pairing, decoration score, attractiveness, and luxury-tier gates.
- Chef, waiter, and errand staff; hiring, firing, payroll hooks, shopping,
  cooking, delivery, payment, cleaning, dishwashing, task reservations, and
  stalled-task recovery.
- Customer flow from entering through seating, ordering, eating, payment, and
  leaving. Regular, Foodie, and Family archetypes are data-driven.
- Menu and recipe management, kitchen queues, pantry stock, recipe upgrades,
  operational upgrades, daily cycle, rent hooks, reputation, and eight
  sequential expansion levels.
- Versioned three-slot local saves with legacy-key loading, migration,
  validation, corruption quarantine, autosave, manual save, reset, and
  in-flight actor/ticket persistence.
- Deterministic offline progress with an eight-hour cap, pantry-aware rewards,
  and a welcome-back summary.
- Floating feedback, burst effects, synthesized sound effects, mute/volume
  persistence, and an F2 diagnostics overlay.
- Chinese as the default language and English as a runtime-switchable language;
  language preference is device state, separate from gameplay saves.
- Headless simulation and automated coverage for economy, cooking, customers,
  staff, progression, placement, saves, offline progress, pacing, and i18n.

Validation snapshot on 2026-09-18: 124 tests pass, TypeScript passes, and the
production build passes. The build still reports a non-blocking large-chunk
warning.

## 5. Gameplay contract

### Restaurant and placement

- Furniture is placed on the existing grid and cannot overlap invalid cells.
- Removing furniture refunds less than its purchase price.
- Operational furniture remains meaningful: tables provide seats, stoves
  provide cooking slots, counters support service, and sinks/dishwashers support
  dish flow.
- The restaurant starts small and expands through eight sequential areas. Areas
  remain visible while locked and show their price.
- Five luxury tiers gate build items and recipes. Tier unlocks follow expansion
  progress; the exact catalog remains in `src/data/`.

### Customers and orders

- Customers enter only when the restaurant, menu, seating, and staffing can
  support service.
- A customer may order one to four dishes. Orders are first-class entities and
  use explicit queue states.
- Patience is a bottleneck signal. Waiting can reduce the result or cause an
  unhappy exit, but the game should avoid severe punishment.
- Chefs select the oldest useful queued work first. Cooking stations may have
  parallel slots.
- Waiters prioritize delivery, then payment, then cleaning. Every task is
  reservable and must be released if its target becomes invalid.
- A completed visit pays through the central economy service and can produce a
  tip and reputation effect.

### Economy and progression

- Money is the only required currency. Reputation/rating is a progression and
  feedback signal, not a premium currency.
- All money changes go through `EconomySystem`; UI and actor code must not
  mutate the balance directly.
- Operational upgrades are declarative and compiled into one effects bundle.
  Current categories cover chef speed, staff speed, carrying, customer flow,
  patience, tips, satisfaction, dishwashing, and attractiveness.
- Recipe value upgrades remain a separate ingredient-paid level track.
- Content and tunable values belong in `src/data/`; use the existing registries
  and startup validation rather than scattering new constants through the
  scene.
- Balance changes must be verified with tests and, for pacing, live playtests
  using the F2 overlay. The headless pacing model is directional, not a
  replacement for visual playtesting.

### Persistence and offline play

- Save data is versioned (`CURRENT_SAVE_VERSION = 1` at the time of this
  review). Schema changes require a migration and a round-trip test.
- Loading is defensive: parse, validate, migrate, normalize, then hydrate.
  Corrupt payloads are quarantined rather than silently deleted.
- Device preferences such as language and audio volume are not gameplay-save
  fields.
- Offline progress is an estimate, capped at eight hours and limited by pantry
  and service capacity. It must remain deterministic for a given snapshot and
  time interval.

### Presentation and language

- Player-facing text is localized through `src/i18n/`. English is the canonical
  catalog shape; Chinese is the default catalog.
- Content definitions keep stable IDs and canonical data names. Localization
  happens at render time so changing language does not migrate saves.
- Debug and performance diagnostics remain in English.
- Feedback should make money, completed dishes, upgrades, staff joins, and area
  unlocks legible without overwhelming the restaurant view.

## 6. Architecture contract

The current architecture is intentionally incremental:

```text
data + pure simulation rules
          ↓
systems and persistence
          ↓
GameScene orchestration, input, actors, and rendering
```

Important boundaries:

- `src/data/` is the source of truth for content and tunable balance.
- `src/simulation/` contains deterministic rules, entity IDs, clock/RNG
  abstractions, events, headless service simulation, and progression logic.
- `src/systems/` owns gameplay services such as economy, cooking, customers,
  staff, reputation, placement, saves, audio, and visual feedback.
- `src/persistence/` owns save envelopes and migrations.
- `GameScene.ts` remains the live actor/rendering authority. It is still large
  and contains scene-coupled customer/staff/ticket state; extraction is an
  ongoing refactor, not a claim that the scene is already a pure view.
- `src/tests/` must exercise rules without starting Phaser wherever practical.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for module-level details.

## 7. Non-negotiable constraints

- Keep Phaser for the root game unless the user explicitly requests an engine
  change.
- Preserve working gameplay and save behavior when making refactors. Prefer
  small extractions with tests over a rewrite.
- Do not add multiplayer, authentication, remote persistence, monetization, or
  server-authoritative economy to the root game as an inferred “next step”.
  These are separate decisions, not hidden requirements.
- Do not make Phaser sprites the only representation of important gameplay
  facts. New rules should be pure or have a testable service boundary.
- Use injectable randomness and clocks in important gameplay rules. Avoid new
  direct `Math.random()`, `Date.now()`, or `performance.now()` calls in logic
  that should be deterministic.
- Use stable IDs for saved entities and route transactions through their owning
  systems.
- Run startup content validation in development paths and fail loudly on broken
  definitions.
- `GameScene.ts` is already over 1,000 lines. Do not add another major
  responsibility to it without first evaluating a focused extraction.
- Keep dependencies small. A local implementation is preferred when the
  feature is straightforward and does not justify a new framework.
- Repository-facing documentation, comments, and commits remain in English.

## 8. UX, reliability, and performance targets

- Desktop target is 60 FPS; the current configuration intentionally runs at
  30 FPS and should be improved only with measurement.
- Typical target load is roughly 20–50 active customers, 2–10 staff, and dozens
  of furniture objects, not thousands of agents.
- Prioritize reliability over sophisticated pathfinding. Avoid per-frame full
  scans, unnecessary allocations, and pathfinding every frame.
- Keep a visible reset/new-game path for broken local saves.
- Save on meaningful changes, page visibility changes, and the existing quiet
  debounce; never save every frame.
- UI labels must remain readable, actions must be explicit, color must not be
  the only signal, and mute must remain available.

## 9. Deferred ideas

These are possibilities, not commitments:

- Visual polish beyond the current generated atlas pipeline and a human art
  direction pass.
- More recipes, furniture, staff roles, tutorials, goals, and restaurant
  events.
- A small farm or ingredient-production loop after the restaurant is polished.
- Social visits, leaderboards, or remote saves after a separate product
  decision.
- A backend or multiplayer version based on a deliberately designed new
  boundary, not by importing an unrelated architecture into the root game.

Do not start a deferred idea while a P0/P1 reliability issue, save issue, or
core service-loop regression remains unresolved.

## 10. Current priorities

1. Human playtest the complete service loop, pacing, bilingual UI, audio, and
   visual feedback.
2. Continue the visual/art pass while preserving atlas frame names and save
   compatibility.
3. Harden release behavior: browser lifecycle, edge-case saves, production
   deployment, and measured frame-time improvements.
4. Extract the highest-risk scene-coupled state machines only when a concrete
   bug, test gap, or maintainability win justifies the change.

## 11. Documentation map

- [`docs/README.md`](docs/README.md) — active documentation map.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — implementation boundaries
  and state ownership.
- [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) — qualitative experience and
  design principles.
- [`docs/BALANCE.md`](docs/BALANCE.md) — current numbers and tuning notes.
- [`docs/ASSET_PIPELINE.md`](docs/ASSET_PIPELINE.md) — atlas, character, and
  visual workflow.
- [`docs/AI_PROGRESS.md`](docs/AI_PROGRESS.md) — dated implementation journal,
  not a second product specification.
