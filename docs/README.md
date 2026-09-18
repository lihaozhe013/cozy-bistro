# Documentation Map

The repository has one active product specification and a small set of focused
supporting documents. If a document conflicts with the code, tests, or
`SPEC.md`, update the document instead of creating another competing plan.

## Active documents

- [`../SPEC.md`](../SPEC.md) — product direction, implemented behavior,
  constraints, and priorities. This is the canonical document.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — runtime layers, state ownership,
  persistence, testing boundaries, and known structural debt.
- [`GAME_DESIGN.md`](GAME_DESIGN.md) — player experience, design pillars, and
  qualitative decisions.
- [`BALANCE.md`](BALANCE.md) — current economy, pacing, upgrade, and expansion
  values. Code under `src/data/` remains authoritative for exact numbers.
- [`ASSET_PIPELINE.md`](ASSET_PIPELINE.md) — generated atlases, character input,
  naming, and visual QA workflow.
- [`AI_PROGRESS.md`](AI_PROGRESS.md) — dated implementation history and the
  current validation snapshot.

## Separate track

The `v2/` directory is a separate Three.js + SpacetimeDB track. Its local
README and documents describe that track only; they are not requirements for
the root 2D game.

## Archive

[`archive/`](archive/) contains superseded plans, duplicate concept notes, and
historical audits kept for context. Archived documents are not normative and
should not be extended.
