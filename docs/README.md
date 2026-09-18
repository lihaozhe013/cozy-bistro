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

## Removed material

Superseded plans, duplicate concept notes, imported art inputs, and the separate
3D/SpacetimeDB project were intentionally removed during the 2026-09 cleanup.
Git history remains the recovery path for material that is no longer part of
the product.
