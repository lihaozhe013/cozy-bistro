# Balance

This document records the current tuning snapshot for the root 2D game. Exact
values live in `src/data/balance.ts`, `src/data/upgrades.ts`, and the content
registries; update both code and this document when tuning intentionally
changes.

## Starting state

| Value | Current |
| --- | ---: |
| Starter money | `$520` |
| Starter team | 1 chef, 1 waiter, 1 errand helper |
| Starter grant floor | `$220` |
| Ingredient unit cost | `$5` |
| Day length | 180 seconds |
| Base rent | `$0` by default; rent cycle is 24 real-hours |

## Customers and service

| Value | Current |
| --- | ---: |
| Spawn interval | `60000 / spawnRate × 1.35`, clamped to 2.2–15 seconds |
| Blocked retry | 2.5 seconds |
| Turnaway retry | 2.2 seconds |
| Patience | service + cook + 55 + 14/item seconds, clamped to 90–260 seconds |
| Eating time | 30 seconds |
| Payment interaction | 0.75 seconds |
| Order size | 1–4 dishes, influenced by seat quality and archetype |

Staff defaults:

- Chef hire: `$80 × (1 + 0.1 × chef count)`, rounded up to `$5`.
- Waiter hire: `$70` with the same growth curve.
- Errand hire: `$65` with the same growth curve.
- Fire costs: `$18` / `$14` / `$12` by role.
- Customer speed: 90 px/s; staff speed: 125 px/s.
- Order handoff: 0.8 seconds; cleaning: 0.8 seconds.
- Manual dishwashing: 2.8 seconds; dishwasher: 2.2 seconds.
- Payroll is `$0` by default and remains admin-tunable.

## Food economy

- Ingredient cost defaults to `$5` per unit.
- Recipe definitions own sell prices, preparation times, ingredients, and
  satisfaction values.
- Recipe upgrades use `level²` units of each required ingredient, up to level
  10.
- The five luxury tiers are unlocked by expansion level: tier 1 at level 0,
  tier 2 at level 1, through tier 5 at level 4 and above.
- The intended tier profit bands are approximately `$8–20`, `$27–35`,
  `$45–57`, `$61–81`, and `$87–125`. These are tuning targets, not runtime
  validation rules.

## Operational upgrades

| Upgrade | Max | Base cost | Growth | Effect per level |
| --- | ---: | ---: | ---: | --- |
| Chef Training | 8 | 120 | 1.62 | +8% cook speed |
| Queue Trainers | 8 | 100 | 1.60 | +8% staff speed |
| Serving Trays | 3 | 400 | 1.90 | +1 plate per trip |
| Street Charm | 6 | 150 | 1.70 | +10% spawn rate |
| Comfy Waiting | 5 | 90 | 1.55 | +10 seconds patience |
| Warm Smiles | 5 | 130 | 1.60 | +4% tip chance |
| Signature Touch | 5 | 140 | 1.60 | +10% bill as tip |
| Plating School | 6 | 160 | 1.65 | +1 dish satisfaction |
| Sink Workflow | 5 | 110 | 1.58 | +12% wash speed |
| Window Display | 5 | 150 | 1.60 | +0.1 attractiveness |

Per-recipe levels are a separate ingredient-paid progression track.

## Expansion and menu

| Value | Current |
| --- | ---: |
| Expansion levels | 0–8 |
| First expansion | `$900` by default |
| Expansion cost | `firstCost × 1.5^(level - 1)` by default |
| Luxury tier unlock | tier = expansion level + 1, capped at 5 |
| Active menu cap | 3 recipes per category |
| Offline minimum | 60 seconds away |
| Offline cap | 8 hours |
| Offline estimate cap | 500 served guests |

Expansion costs and rent can be changed by admin settings for development and
playtesting. The default values above are the product baseline.

## Offline model

Offline service estimates dishes per minute as the minimum of demand, chef
output, and waiter output. It consumes a copied pantry snapshot, stops when a
required ingredient is unavailable, applies shopping capacity when auto-shop is
active, and produces a deterministic rating score. It is intentionally an
estimate rather than a frame-by-frame simulation.

## Tuning workflow

Use the F2 overlay to inspect revenue/minute, guests/minute, served/lost rates,
kitchen pressure, task lists, money, upgrade levels, day, rating, save size, and
timings. The headless pacing model checks direction and cost-curve regressions;
live browser playtests decide whether the experience actually feels good.

Current model note: the default first expansion projects at roughly 33 minutes
under a steady-state, goal-hoarding model. It may feel slower or faster in live
play because pathing, patience, layout, and player decisions are not fully
represented by that model.
