# Development Progress

This is a dated implementation journal. It is not a second product
specification; current direction and constraints live in [`../SPEC.md`](../SPEC.md).

## Current milestone

The root 2D game has a complete playable baseline from the original M0–M9
implementation pass. The next work is M10 visual polish and M11 release
hardening, both starting with human playtesting.

Validation snapshot on 2026-09-18:

- `pnpm run typecheck` passes.
- `pnpm test` passes: 13 files, 124 tests.
- `pnpm run build` passes with the existing large-chunk warning.

## Completed

- **Repository audit:** chose the root Phaser game as the development target;
  documented `v2/` as a separate 3D/SpacetimeDB track.
- **Core architecture:** added deterministic clocks and RNG, stable entity IDs,
  typed events, versioned saves, migration/quarantine, centralized balance,
  content validation, and headless tests.
- **Service loop:** added a deterministic customer/order/cooking/staff model
  with legal customer transitions, patience, oldest-first cooking, waiter task
  priorities, batching, reservations, and deadlock checks.
- **Economy and upgrades:** added ten data-driven operational upgrades, live
  effect wiring, recipe progression, upgrade UI, and persistence.
- **Expansion and customer content:** added eight validated expansion areas,
  sequential costs, five luxury tiers, and Regular/Foodie/Family archetypes.
- **Feedback pass:** added floating text, burst feedback, synthesized SFX,
  mute/volume persistence, and event-driven subscriptions.
- **Instrumentation and pacing:** added the F2 metrics overlay, a deterministic
  pacing model, and balance tuning for the current progression envelope.
- **Offline progress:** added deterministic, pantry-aware, eight-hour-capped
  estimates with tests and a welcome-back summary.
- **Internationalization:** added typed English/Chinese catalogs, Chinese as
  the default, runtime switching, localized content names, and CJK-safe text
  handling.

## In progress

- Human visual and audio pass for the complete service loop.
- Art-direction work for generated atlases while preserving frame contracts.
- Release hardening around browser lifecycle, performance, deployment, and
  edge-case save recovery.

## Next

1. Playtest the first ten minutes and verify the pacing against the F2 metrics.
2. Fix any P0/P1 issues found in save, customer, staff, or economy behavior.
3. Improve the most visible repeated art assets and inspect all major UI states
   in both languages.
4. Extract scene-coupled logic only when a concrete testability or reliability
   problem justifies it.

## Architectural decisions

1. The root 2D game is the canonical track for this specification. `v2/` is
   independent and is not a source of requirements.
2. Existing working behavior is preserved through incremental extraction, not a
   speculative rewrite.
3. Gameplay rules are tested without booting Phaser whenever practical.
4. Save data keeps stable field meanings, adds explicit schema versioning, and
   quarantines corrupt payloads instead of deleting them.
5. Device preferences such as language and audio volume stay outside gameplay
   saves.
6. English is the canonical localization catalog shape; Chinese is the default
   player language.

## Known issues

- `src/scenes/GameScene.ts` is still approximately 14,756 lines. New major
  responsibilities should be evaluated for extraction first.
- The root configuration currently targets 30 FPS; a move toward 60 FPS needs
  measurement because movement, timers, and tweens are not yet one clock.
- Headless checks cannot validate canvas pixels, visual hierarchy, or audio
  quality; those require a browser playtest.
- Admin overrides and central balance defaults still provide two tuning paths;
  future tuning should keep the distinction explicit.
- The production JavaScript bundle is large enough to trigger Vite's warning.

## Balance notes

Current starter money is `$520`; the first expansion defaults to `$900` with a
`1.5x` cost multiplier. The full table is in [`BALANCE.md`](BALANCE.md), and
the implementation remains authoritative in `src/data/balance.ts` and related
data registries.
