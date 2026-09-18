# Game Design

This is the qualitative companion to [`../SPEC.md`](../SPEC.md). It explains
what the game should feel like; code and data remain authoritative for exact
rules and values.

## Player fantasy

The player starts with a tiny, imperfect bistro and gradually turns it into a
busy, attractive, mostly self-running restaurant. The reward is watching a
layout and a team solve problems that were visible a few minutes earlier.

## Experience pillars

- **Cozy, not frantic:** waiting creates gentle pressure, not punishment.
- **Alive at a glance:** customers, staff, cooking, dishes, money, and locked
  expansions should be visible in the room.
- **Small decisions with clear outcomes:** place a table, hire a role, improve a
  bottleneck, or open a new area.
- **Progression with texture:** new furniture and recipes should change the
  restaurant's look and operation, not only increase a number.
- **Idle-friendly:** the game should make progress while unattended without
  pretending the offline estimate is a full replay.

## Pacing intent

The first minutes should contain a functioning restaurant and early earnings.
The player should see a meaningful first upgrade soon after, encounter a clear
service bottleneck, and understand why the next expansion is desirable within
the first session. Exact pacing is tuned through `src/data/balance.ts`, the
headless pacing model, and live F2 metrics.

## Feedback language

Use a consistent visual vocabulary:

- money and tips: warm green / coin motion;
- completed food: ready signal near the kitchen;
- upgrades: level-up emphasis;
- expansion: persistent sign while locked, burst and message when purchased;
- problems: readable status bubbles and metrics rather than opaque errors.

## Player interaction

Mouse and touch are primary. Keyboard shortcuts (`S`, `M`, `F2`, and `Esc`) are
convenience tools. The player manages the room through panels and direct
placement; they do not control an avatar or manually walk staff.

## Deliberate boundaries

The root game does not currently pursue multiplayer, combat, monetization,
open-world movement, complex crafting, story quests, or a large farm system.
Those ideas may be revisited only as explicit product decisions after the core
restaurant is polished.
