# Cozy Bistro

Cozy Bistro is an original cozy 2D restaurant-management and light idle-tycoon
game. The player arranges a small bistro, hires staff, serves autonomous
customers, and grows the restaurant through visible upgrades and expansions.

The root `src/` game is the canonical development track described by
[`SPEC.md`](SPEC.md).

## Run the root game

```bash
pnpm install
pnpm dev
```

Open the Vite URL printed in the terminal, usually
`http://127.0.0.1:5173`.

## Verification

```bash
pnpm run typecheck
pnpm test
pnpm run build
```

`pnpm run build` builds the root 2D game. The current production build has a
non-blocking large-chunk warning.

## Controls

- Click a build item, then click a valid grid cell to place furniture.
- Use **Move** to reposition placed furniture and **Remove** to sell it for a
  partial refund.
- Hire a chef and waiter from **Restaurant Ops** to start service.
- Buy ingredients when the pantry is low; **Cook** invites a test guest.
- **S** saves, **Esc** clears the current selection, and **M** toggles sound.
- **F2** toggles the developer metrics overlay.
- Use **English / Chinese** in the title bar to change the device language.
- **New Game** resets a broken save; **Starter Grant** provides a recovery
  balance when available.

## Current baseline

The root game includes furniture placement, cooking, customer service, staff
automation, recipe and operational upgrades, eight expansion levels, three
customer archetypes, reputation, local save slots, migration and corruption
recovery, deterministic offline progress, bilingual UI, visual feedback, and
headless gameplay tests.

The latest validation snapshot is recorded in
[`docs/AI_PROGRESS.md`](docs/AI_PROGRESS.md). Exact product behavior and
constraints live in [`SPEC.md`](SPEC.md).

## Project map

```text
src/
  main.ts                 Phaser bootstrap
  scenes/GameScene.ts     live scene orchestration and rendering
  simulation/             deterministic rules and headless service model
  systems/                gameplay services, saves, feedback, and audio
  data/                   content and tunable balance
  persistence/            save schema and migrations
  i18n/                   English and Chinese catalogs
  tests/                  headless gameplay tests
scripts/generate_atlases.py
  procedural and input-driven atlas generation
docs/
  active documentation
```

## Documentation

- [`SPEC.md`](SPEC.md) — canonical product and engineering specification.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — implementation boundaries.
- [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) — experience and design pillars.
- [`docs/BALANCE.md`](docs/BALANCE.md) — current values and tuning notes.
- [`docs/ASSET_PIPELINE.md`](docs/ASSET_PIPELINE.md) — visual asset workflow.
- [`docs/README.md`](docs/README.md) — complete documentation map.

## Originality boundary

The project uses original names, data, visuals, and mechanics. The game may
draw on broad restaurant-management genre conventions but does not include
copyrighted assets, names, UI, characters, or exact mechanics from another
game.
