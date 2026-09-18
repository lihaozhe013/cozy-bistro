# Architecture

This document describes the current root 2D Phaser implementation. The separate
`v2/` track is intentionally outside this architecture.

## Runtime layers

```text
src/
  main.ts                         Phaser bootstrap
  scenes/GameScene.ts             scene orchestration, input, actors, rendering
  simulation/                     deterministic rules and headless service model
    Random.ts                     injectable RNG and seeded test RNG
    GameClock.ts                  wall/manual/scene clock boundary
    EntityIds.ts                  save-stable IDs
    EventBus.ts                   typed gameplay events
    RestaurantSimulation.ts       headless service-loop model
    orders/                       order states and queue behavior
    customer/                     customer states and patience math
    staff/                        task types and reservation registry
    cooking/                      cooking stations and parallel slots
    progression/                  upgrades, expansion, pacing, offline progress
  systems/                        gameplay services
    EconomySystem                 money, transactions, daily totals
    CookingSystem                 menu, pantry, prepared servings, errands
    CustomerSystem                spawn and order composition rules
    StaffSystem                   headcount, hiring, firing, payroll
    ReputationSystem              decoration, attractiveness, ratings
    DayCycleSystem                day and rent accumulators
    RestaurantGridSystem          grid and isometric math
    FurniturePlacementSystem      placement, movement, selling, validation
    SaveSystem                    localStorage repository and recovery
    FeedbackSystem                floating text, scale feedback, particles
    AudioSystem                   synthesized feedback sounds
  persistence/                    save envelope and migration service
  data/                           content registries, balance, visual metadata
  i18n/                           typed English/Chinese catalogs and formatting
  components/types.ts             shared runtime and save interfaces
  tests/                          headless gameplay and content tests
```

## State ownership

- Gameplay services own money, pantry, staffing, ratings, day totals, menu
  state, progression, and save hydration.
- `GameScene` owns live Phaser actors such as guests, staff, meal tickets, and
  seats. These objects still contain scene-coupled state and are the current
  live runtime authority for positions and animations.
- `src/simulation/` provides pure rules and a deterministic service-loop model.
  It is an executable specification and test surface, but it is not yet a
  complete replacement for every scene path.
- Rendering, audio, and feedback subscribe to typed events rather than being
  imported by simulation rules.

## Data and content boundaries

- `src/data/` is the source of truth for furniture, recipes, customers,
  upgrades, expansions, balance, and visual frame metadata.
- `contentValidation.ts` checks IDs, references, ranges, expansion geometry,
  and default content during startup.
- The scene may own layout constants and presentation settings, but new gameplay
  numbers belong in data or a focused system.

## Save pipeline

```text
save: create state → validate/stamp version → serialize → localStorage
load: raw payload → parse → validate → migrate → normalize → hydrate
bad:  quarantine original payload → continue with a safe default state
```

The current on-disk version is `1`. Three save slots and the legacy key remain
supported. In-flight guests, tickets, staff actors, and trash are persisted so
reload does not erase the active restaurant loop.

Device preferences such as language and audio volume use separate localStorage
keys and are deliberately excluded from gameplay saves.

## Determinism and tests

- Important random choices use `RandomSource`; tests use `SeededRandom`.
- Timer-heavy rules use `GameClock` or a manual clock.
- The headless simulation verifies customer completion, order uniqueness,
  staff reservations, waiter batching, chef ordering, upgrade effects, and
  revenue conservation.
- `pnpm test` runs Vitest over `src/tests/` without importing Phaser in the
  tested rules.

## Internationalization

```text
src/i18n/locales/en.ts   canonical dictionary shape
src/i18n/locales/zh.ts   Chinese dictionary with compile-time key parity
src/i18n/index.ts        t(), language state, persistence, events
src/i18n/content.ts      localized names for data IDs
src/i18n/fonts.ts        CJK-safe font stacks
src/i18n/format.ts       money/date/wrapping helpers
```

Content keeps stable IDs and canonical data values; text is localized at render
time. Structural scene labels re-render on the `language-changed` event, while
per-frame labels re-read the active language. Developer diagnostics remain in
English.

## Known structural debt

- `GameScene.ts` is approximately 14,756 lines. It should remain an orchestrator
  over time, but extraction must be incremental and behavior-preserving.
- The scene currently mixes Phaser tweens, delayed calls, and delta-based
  accumulators, so simulation speed is intentionally not partially implemented.
- The configuration targets 30 FPS; changing it should follow measured browser
  profiling rather than a documentation-only target.
- The root game and `v2/` have different architectures and deployment history;
  do not merge their boundaries casually.
