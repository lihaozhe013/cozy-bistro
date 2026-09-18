# Architecture

Live description of the root 2D Phaser project as evolved by the master plan.
(`v2/` is a separate 3D/SpacetimeDB experiment and is intentionally not part of
this architecture.)

## Layering

```text
src/
  main.ts              Phaser bootstrap (1600x900, FIT scale)
  scenes/GameScene.ts  Phaser orchestration: rendering, input, timers, scene-only glue
  simulation/          Pure gameplay logic (no Phaser imports)
    Random.ts          RandomSource interface, SeededRandom, between/clamp/pick
    GameClock.ts       GameClock interface, WallClock / ManualClock / SceneClock
    EntityIds.ts       Save-stable ids for guests/tickets/furniture/staff (§10)
    EventBus.ts        Typed event bus + shared `gameEvents` (§33)
    RestaurantSimulation.ts  Headless service-loop engine (M2/M3 spec + tests)
    orders/            Order entity + queue (states per plan §15)
    customer/          Customer FSM vocabulary, transitions, patience math
    staff/             Staff task types + TaskReservationRegistry (§21)
    cooking/           CookingStation with parallel speed-multiplied slots
  systems/             Class-based gameplay services (pure; import simulation only)
    EconomySystem      All money in/out, daily totals, transaction log
    CookingSystem      Menu roster, pantry, prepared servings, errand queues
    CustomerSystem     Spawn-rate math, order composition (RNG-injectable)
    StaffSystem        Headcount, hire/fire pricing, payroll ticks
    ReputationSystem   Decor/attractiveness scores, rating history
    DayCycleSystem     Day/rent/playtime accumulators
    RestaurantGridSystem  Isometric grid math (+ Phaser drawing helpers)
    FurniturePlacementSystem  Place/move/sell rules (grid via structural type)
    SaveSystem         localStorage repository: stamp, validate, migrate, quarantine
  persistence/
    SaveGame.ts        CURRENT_SAVE_VERSION + envelope type
    SaveMigrationService.ts  Parse -> validate -> migrate (v0 -> v1), reject garbage
  data/                Static content + tuning
    balance.ts         Central tunable gameplay values (§77)
    furniture.ts recipes.ts customers.ts upgrades.ts graphicsTheme.ts
    visualAssets.ts    Atlas frame metadata
    contentValidation.ts  Startup duplicate/reference/range checks (§79)
  components/types.ts  Shared interfaces incl. SaveGameState
```

## State ownership

- The **systems** own gameplay facts (money, pantry, headcount, ratings, time).
- **GameScene** owns live actors: `Guest`, `Actor`, `MealTicket`, `DiningSeat`.
  These structs currently embed Phaser containers, so the scene loop is still
  the runtime authority for positions/animations (§9 gap, extraction planned in
  M2/M3). Simulation primitives from `src/simulation/` are used inside the
  scene (ids, events) so extraction becomes a move, not a rewrite.
- Feeding the scene: `gameEvents.emit(...)` at customer-arrived, order
  created/ready/served, customer-paid, money-earned, upgrade-purchased,
  area-unlocked, staff-hired. HUD/audio/feedback subscribe; systems never
  import rendering.

## Save pipeline

```text
save: createSaveState() -> SaveSystem.save stamps {version: CURRENT_SAVE_VERSION}
load: raw -> JSON.parse -> migrateSave() (shape-validate, normalize, drop
      orphan tickets) -> system.hydrate(...) -> scene defaults for undefined
      optionals -> applyOfflineProgress()
corrupt: payload copied to `<key>-corrupt-<ts>` (never deleted), fresh safe
      state continues
```

Legacy fields stay `undefined` on purpose where the scene has its own
fallbacks (menuRecipeIds, stockTarget, expansionLevel, staff) so old saves
hydrate exactly like before.

## Determinism & tests

- Gameplay randomness flows through `RandomSource` (`SeededRandom` in tests).
- Time flows through `GameClock`/ManualClock in tests; the scene uses its
  `update(time, delta)` value via SceneClock where abstraction is needed.
- `pnpm test` runs vitest (node env) over `src/tests/*.test.ts`; no Phaser is
  imported by any tested module (Phaser cannot load without a browser).

## Internationalization (i18n)

All user-facing strings live in `src/i18n/`; nothing is rendered from a hard-coded
literal. Chinese (`zh`) is the default; `en` is the canonical catalog.

```text
locales/en.ts   canonical message catalog; its inferred shape == Dictionary
locales/zh.ts   const zh: Dictionary — TS errors on any missing/extra key
index.ts        t(key, params) + {token} interpolation, get/set/toggleLanguage,
                localStorage["cozy-bistro-language"] (device-level, not a save),
                emits "language-changed" on the EventBus, translateLegacyText
content.ts      per-id name/description maps for recipes/furniture/upgrades/
                expansions/customers/ingredients (English string is the key)
fonts.ts        CJK-safe font stacks (Phaser resolves per-glyph fallback)
format.ts       formatMoney / formatDateTime / shouldBreakByCharacter
```

- Text is localized at **render time**: systems keep English canonical
  `name`/`description` in `src/data` and store ids in saves, so switching
  language never dirties or migrates a save.
- `GameScene` tracks structural labels via a producer-closure registry
  (`trackLocalizedText`); on `language-changed` every producer re-runs and the
  entry self-unregisters on the Phaser `destroy` event. Per-frame text
  (`updateStats`, catalog/label refreshers) re-localizes automatically.
- Actor status bubbles render short icon badges parsed from canonical English
  status text (`tEn`), localized to the active language by
  `localizeBubbleBadge`, so the English classifier stays stable across locales.
- Word wrap flips to Phaser character wrap (`setWordWrapWidth(w, true)`)
  whenever text contains CJK; action-message truncation counts CJK as 2 units.
- Debug overlay and the admin performance diagnostics stay English (developer
  tools, not player UI).

## Known deviations from the master plan's suggested layout

- No `app/`, `entities/`, `ui/` folders yet — existing `scenes/systems/data`
  layout predates the plan and works; reorganizing purely for aesthetics is
  forbidden by §1.1/§94.
- Restaurant expansion uses **luxury tiers 1–5 gated by expansion levels
  0–8**, richer than the plan's "3 areas"; kept as-is.
- Currency is a single `$` money pool plus 1–5 star reputation; the plan's
  optional secondary "reputation" currency maps to the existing rating system.
