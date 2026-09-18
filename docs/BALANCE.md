# Balance

All numbers below live in `src/data/balance.ts` (gameplay) or in the data
files noted per line. This document records **current** values; Milestone 8
tunes them toward the plan's pacing targets.

## Starting state

| Value | Current | Source |
| --- | ---: | --- |
| Starter money | $520 | balance.ts `starterMoney` |
| Starter team (new game) | 1 chef, 1 waiter, 1 errand | GameScene create |
| Starter grant floor | $220 | balance.ts `starterGrantTarget` |
| Ingredient unit cost | $5 | balance.ts `defaultIngredientUnitCost` |
| Day length | 180 s | DayCycleSystem default |
| Rent | $0 base (charged every 24 real-hours cycle) | balance.ts + admin settings |

## Customers

| Value | Current |
| --- | ---: |
| Spawn interval | 60000 / spawnRate ms × 1.35, clamped 2.2–15 s |
| Blocked-retry (closed/full/no staff) | 2.5 s |
| Turnaway retry | 2.2 s |
| Patience | service+cook+55+14/item s, clamped 90–260 s |
| Eating time | 30 s |
| Payment interaction | 0.75 s |
| Order size | 1–4 dishes, category-weighted by seat quality |

## Staff

| Value | Current |
| --- | ---: |
| Chef hire | $80 × (1 + 0.1·count), rounded up to $5 |
| Waiter hire | $70 base (same curve) |
| Errand hire | $65 base (same curve) |
| Fire cost | $18/$14/$12 flat |
| Walk speed | staff 125 px/s, customers 90 px/s |
| Order handoff | 0.8 s |
| Table cleaning | 0.8 s |
| Dishwashing | manual 2.8 s, dishwasher 2.2 s |
| Payroll | $0/staff/min by default (admin-tunable) |

## Food economy

- Recipe price = ingredient cost + profit; profit =
  `(starterProfit + tierBonus) × upgradeLevel`, starterProfit = 3,
  tierBonus = luxuryTier − 1.
- Recipe upgrade cost: `level²` units of **each** ingredient (max level 10).
- Tier profit target bands (docs/luxury-balance.md): T1 $8–20 … T5 $87–125.

## Operational upgrades (M4, data-driven)

| Upgrade | Max | Base cost | Growth | Per level |
| --- | ---: | ---: | ---: | --- |
| Chef Training (cook speed) | 8 | 120 | 1.62 | +8% cook speed |
| Queue Trainers (walk speed) | 8 | 100 | 1.60 | +8% staff speed |
| Serving Trays (carry) | 3 | 400 | 2.30 | +1 plate/trip |
| Street Charm (flow) | 6 | 150 | 1.70 | +10% spawn rate |
| Comfy Waiting (patience) | 5 | 90 | 1.55 | +10 s patience |
| Warm Smiles (tip chance) | 5 | 130 | 1.60 | +4% tip chance |
| Signature Touch (tip size) | 5 | 140 | 1.60 | +10% bill as tip |
| Plating School (satisfaction) | 6 | 160 | 1.65 | +1 dish satisfaction |
| Sink Workflow (dishwasher) | 5 | 110 | 1.58 | +12% wash speed |
| Window Display (attract.) | 5 | 150 | 1.60 | +0.1 attractiveness |

Plus the pre-existing per-recipe upgrade track (levels 1–10, paid in
ingredients).

## Progression

| Value | Current |
| --- | ---: |
| Expansion levels | 0–8 (`maxExpansionLevel`) |
| Expansion cost | 5000 × 2^(n−1) (admin-tunable) |
| Tier unlock mapping | tier N requires expansion level N (see luxury-balance.md) |
| Menu cap | 3 active recipes per category |

## Offline progress

| Value | Current |
| --- | ---: |
| Minimum counted away-time | 60 s |
| Cap | 6 h (plan §46 target is 8 h — tune in M8/M9) |
| Max guests in estimate | 500 |
| Model | capacity = min(demand, chefOutput, waiterOutput) dishes/min; consumes pantry |
| Offline trash drip | 1 drop roll / 3 min, 5% chance |

## Measurement notes (M8)

Live instrumentation exists behind **F2** (revenue/min, guests-min,
kitchen queue pressure, staff task lists, save size/version). Numbers are
scene-derived, so pacing tuning must come from live playtests; the headless
simulation validates *rules* (throughput direction, upgrade effects) but its
timings are representative, not scene-identical.

## Pacing targets (plan §50, to verify in M8 via F2 playtests)

First purchase < 60 s · first upgrade < 2 min · first expansion < 8–15 min ·
full run 30–60 min. Current expansion #1 at $5,000 is likely too steep for
15 minutes; M8 will test 1,200–2,500.

## Final progression values (M8 tuning, 2026-09-17)

Tuned via `src/simulation/progression/PacingModel.ts` (reuses the live spawn-rate
formula, real recipe economics, real upgrade/expansion cost curves) with a
goal-hoarding purchase policy. `src/tests/pacing.test.ts` locks the envelope:

| Knob | Before | After | Where |
| --- | --- | --- | --- |
| First expansion cost | $5,000 | **$900** | `balance.ts defaultFirstExpansionCost` |
| Expansion cost multiplier | 2.0 | **1.5** | `balance.ts defaultExpansionCostMultiplier` |
| Serving Trays growth | 2.3 | **1.9** | `upgrades.ts` (plan §27 band is 1.5–1.9; old value violated it) |

Projected pacing (model, deterministic): expansion 1 ≈ 33 min, core upgrades
(80% of levels) ≈ 55 min, all 8 expansions ≈ ~3 h long tail. Model is a
steady-state upper bound (no pathing/patience losses), so live play is expected
slightly slower — expansions remain admin-tunable at runtime.

Model assumptions (documented constants in PacingModel.ts): starter room fits
3 tables (6 seats); each expansion adds 4-10 seats per `seatsPerExpansionLevel`;
table set $95; hiring chef/waiter per StaffSystem formula; seat cycle 1.0 min;
waiter trip 12 s base. Deviating from these only shifts absolute minutes, not
the ordering.
