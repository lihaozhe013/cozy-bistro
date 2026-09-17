# Game Design

Companion to `game-design.md` (original concept notes). This file tracks the
design **as implemented** while executing master_plan.md.

## Fantasy & loop

Tiny restaurant → crowded automated bistro. Core visible loop (implemented):

```text
pedestrian street → door → seat → expectation → order 1-4 dishes
→ kitchen queue (stove slots) → waiter pickup → serve → eat (anim)
→ bill → pay at counter → leave → (waiter cleans seat)
player: earns $, upgrades recipes/menu, buys furniture & expansions,
hires/fires chef/waiter/errand, auto-shop keeps pantry full
```

## Pillars (current state)

- **Autonomy**: staff & customers fully AI-driven; player = manager via UI.
- **Visible progression**: 8 expansion levels gate luxury tiers 1–5 across
  furniture and recipes; expansion signs show lock + price in-world.
- **Gentle pressure**: patience affects ratings/tips, not instant losses;
  angry exits are tracked but rare by design.
- **Idle-friendly**: offline progress converts away-time into served guests
  and money (capacity model, capped); autosave + 3 manual slots.
- **Data-driven**: furniture, recipes, customer archetypes, upgrades, and all
  tuning live under `src/data/`.

## Controls

Mouse/touch: build/move/remove/seat/cook modes, click-to-place, Esc cancels,
S saves, drag + wheel pan/zoom the isometric room. Keyboard is optional.

## Systems overview

See docs/ARCHITECTURE.md. Scene scheduler ticks: service assignment 200ms,
kitchen assignment 200ms, stall recovery 1s, auto-shop 0.5s, chef sync 1s,
personal-space steering 90ms, quiet-save debounce 2.2s.

## Feedback vocabulary (event bus, plan §33)

customer-arrived · customer-paid · order-created/ready/served ·
money-earned · upgrade-purchased · area-unlocked · staff-hired.
Rendering juice (floating text, particles, SFX) subscribes to these in M7.

## Non-goals (unchanged from plan §7)

No multiplayer, monetization, combat, crafting trees, or open-world movement.
`v2/` Three.js experiment is a separate track; this design document only
governs the 2D game.
