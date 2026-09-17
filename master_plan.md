# Cozy Bistro — AI Autonomous Development Master Plan

## 0. Mission

You are the primary implementation agent for this repository.

Your task is to evolve the existing Cozy Bistro prototype into a polished, highly playable, cozy 2D restaurant management / idle tycoon game designed primarily for private play among a small group of friends.

This is not a commercial product.

Prioritize:

* fun
* polish
* clarity
* satisfying progression
* maintainable systems
* fast iteration
* data-driven content
* reliable saves
* strong automated tests for gameplay logic
* an architecture that future coding agents can understand easily

Do not optimize for:

* monetization
* advertisements
* microtransactions
* anti-cheat
* massive scale
* live-service infrastructure
* enterprise abstractions
* premature multiplayer networking

The intended feel is:

* cozy
* cute
* immediately understandable
* satisfying to watch
* low mechanical stress
* visually busy in a pleasant way
* similar to mobile idle-management games without monetization pressure

The player should frequently experience:

* customers arriving
* staff moving
* food being prepared
* money appearing
* upgrades visibly improving operations
* new areas unlocking
* numbers increasing
* bottlenecks becoming obvious
* solving those bottlenecks through upgrades

The project should become a game that is pleasant both to actively play and to leave running.

---

# 1. Autonomous Agent Operating Rules

## 1.1 Inspect before changing

Before making architectural changes:

1. inspect the repository
2. inspect `README.md`
3. inspect `package.json`
4. inspect `src/`
5. inspect `docs/`
6. inspect existing systems
7. inspect existing data definitions
8. inspect existing save format
9. run the project
10. run existing tests, typecheck, lint, and build if available

Treat the actual repository as authoritative.

This document describes desired behavior and architecture, but existing functional code should be preserved when reasonable.

Do not rewrite working systems merely because another design looks cleaner.

---

## 1.2 Work autonomously

Do not stop to ask routine questions.

When multiple reasonable implementations exist:

* choose the simplest robust option
* document the decision
* continue implementation

Only stop for human input when a choice is genuinely irreversible or impossible to infer.

Examples that do NOT require asking:

* naming an internal interface
* choosing between equivalent Phaser APIs
* selecting reasonable default balance values
* adding tests
* reorganizing files
* choosing placeholder sprites
* adding debug tools
* tuning animation duration
* deciding exact starter money

Make a reasonable choice and proceed.

---

## 1.3 Always keep the game runnable

After each meaningful phase:

```bash
npm run build
```

Also run whichever of these exist:

```bash
npm test
npm run test
npm run typecheck
npm run lint
```

Do not leave the main branch in a broken intermediate state.

Prefer small coherent commits if committing is available.

Example commit sequence:

```text
feat: introduce simulation domain model
feat: implement restaurant task queue
feat: add staff state machines
feat: implement restaurant progression
feat: add offline income
feat: improve customer feedback
```

---

## 1.4 Create a development journal

Create:

```text
docs/AI_PROGRESS.md
```

Maintain:

```markdown
# AI Development Progress

## Current milestone

## Completed

## In progress

## Next

## Important architectural decisions

## Known issues

## Balance notes
```

Update this file after every milestone.

Also create:

```text
docs/ARCHITECTURE.md
docs/GAME_DESIGN.md
docs/BALANCE.md
```

Keep them synchronized with implementation.

---

# 2. Product Definition

Working title:

```text
Cozy Bistro
```

Genre:

```text
2D cozy restaurant management
idle tycoon
light automation
progression / expansion
```

Platform:

```text
Desktop browser first
Mobile browser second
```

Primary interaction:

```text
mouse
touch
```

The game should not require keyboard movement.

The player acts primarily as the manager.

Staff and customers should move autonomously.

---

# 3. Core Player Fantasy

The player starts with a tiny restaurant.

Initially:

```text
1 cooking station
1 service counter
2 dining tables
1 chef
1 waiter
a tiny menu
```

The restaurant gradually becomes crowded.

The player earns money and improves:

```text
cooking speed
staff speed
staff carrying capacity
table count
customer flow
food value
restaurant capacity
restaurant area
automation
```

The restaurant visibly evolves from:

```text
tiny struggling cafe
```

into:

```text
busy automated restaurant
```

The player should feel:

> "I built this machine, and now it runs beautifully."

---

# 4. Core Gameplay Loop

The fundamental loop is:

```text
Customer arrives
        ↓
Find available table
        ↓
Sit
        ↓
Place order
        ↓
Order enters kitchen queue
        ↓
Chef prepares food
        ↓
Food becomes ready
        ↓
Waiter picks up food
        ↓
Waiter delivers food
        ↓
Customer eats
        ↓
Customer pays
        ↓
Money becomes available
        ↓
Player earns money
        ↓
Player upgrades restaurant
        ↓
Restaurant handles more customers
        ↓
More revenue
```

This loop must be visible rather than represented only through menus.

The restaurant should feel alive.

---

# 5. Secondary Loop

Long-term progression:

```text
serve customers
      ↓
earn money + reputation
      ↓
upgrade operations
      ↓
unlock recipes
      ↓
unlock equipment
      ↓
unlock new restaurant area
      ↓
serve more valuable customers
      ↓
unlock additional gameplay
```

Later progression may introduce:

```text
farm
ingredient production
special customers
rare recipes
daily objectives
restaurant decorations
friends leaderboard
```

These are not required for the first milestone.

---

# 6. MVP Definition

The first fully playable milestone must support:

## Restaurant

* visible dining area
* visible kitchen area
* entrance
* tables
* chairs
* cooking stations
* serving counter
* upgrade pads or upgrade UI
* expansion zones

## Customers

Customers autonomously:

```text
enter
find seat
sit
order
wait
eat
pay
leave
```

Customer behavior must be understandable visually.

## Staff

At minimum:

```text
Chef
Waiter
```

Chef:

```text
idle
take order
walk to cooking station if needed
cook
place food at pickup point
repeat
```

Waiter:

```text
idle
find ready food
walk to pickup
carry food
walk to customer
deliver
collect payment if configured
clean table
repeat
```

## Economy

Currency:

```text
coins
```

Optional secondary progression currency:

```text
reputation
```

No premium currency.

## Upgrades

At minimum:

```text
chef cooking speed
waiter movement speed
waiter carry capacity
recipe price/value
customer spawn rate
table capacity
cooking station capacity
```

## Progression

At least:

```text
3 restaurant sections
3 food recipes
3 customer variants
10+ meaningful upgrades
```

## Save

Save:

```text
money
reputation
unlocked areas
upgrades
staff state
restaurant layout
recipes
progression
last played timestamp
```

---

# 7. Non-Goals

Do NOT implement during initial development:

```text
PvP
real-time multiplayer
complex authentication
loot boxes
battle passes
paid currency
ads
procedural world generation
combat
equipment rarity systems
large crafting trees
NPC dialogue systems
story quests
open-world movement
complex inventory management
```

Do not let scope drift.

---

# 8. Recommended Architecture

Prefer the following separation:

```text
src/
  app/
  scenes/
  simulation/
  systems/
  entities/
  data/
  ui/
  rendering/
  audio/
  persistence/
  utils/
```

Exact migration depends on the existing repo.

Do not reorganize solely for aesthetics.

The important separation is:

```text
simulation logic
        !=
Phaser rendering
```

The core restaurant rules should be testable without starting Phaser.

---

# 9. Simulation Architecture

Create a pure or mostly pure simulation layer.

Suggested:

```text
src/simulation/
  RestaurantSimulation.ts
  SimulationClock.ts

  customer/
    CustomerState.ts
    CustomerLogic.ts

  staff/
    ChefLogic.ts
    WaiterLogic.ts

  orders/
    Order.ts
    OrderQueue.ts

  cooking/
    CookingStation.ts

  economy/
    Economy.ts

  progression/
    Progression.ts
```

Phaser objects should represent simulation state visually.

Avoid making Phaser sprites the authoritative gameplay state.

Preferred model:

```text
Simulation
   ↓
state changes
   ↓
Scene observes state
   ↓
Sprites animate
```

rather than:

```text
Sprite position == entire game state
```

---

# 10. Entity IDs

Every persistent entity must have a stable ID.

Examples:

```ts
type CustomerId = string;
type StaffId = string;
type FurnitureId = string;
type OrderId = string;
```

Do not use Phaser-generated runtime IDs for saved state.

---

# 11. Game Clock

Introduce a centralized simulation clock.

Do not scatter direct calls to:

```ts
Date.now()
performance.now()
```

through gameplay logic.

Provide something similar to:

```ts
interface GameClock {
  now(): number;
}
```

This makes testing timers easier.

Offline systems may use real timestamps through a dedicated persistence/offline service.

---

# 12. Customer State Machine

Implement customers using explicit states.

Recommended:

```ts
type CustomerState =
  | "entering"
  | "finding-seat"
  | "walking-to-seat"
  | "seated"
  | "ordering"
  | "waiting-for-food"
  | "eating"
  | "waiting-for-payment"
  | "leaving"
  | "done";
```

Optional unhappy states later:

```text
impatient
leaving-angry
```

Transitions must be centralized and observable.

Do not spread customer progression across unrelated scene callbacks.

Each transition should have:

```text
enter condition
exit condition
animation/visual hook
```

---

# 13. Customer Patience

Introduce patience only after the base loop works reliably.

Example:

```ts
interface CustomerDefinition {
  patienceMs: number;
  eatingTimeMs: number;
  baseTipMultiplier: number;
}
```

Waiting too long may reduce:

```text
tip
reputation gain
```

Avoid severe punishment.

This is intended to create bottlenecks, not frustration.

---

# 14. Customer Types

Initial customer types:

```text
Regular
Foodie
Family
```

Possible differences:

Regular:

```text
normal patience
normal value
```

Foodie:

```text
higher order value
slower eating
more reputation
```

Family:

```text
occupies larger table
larger order
higher payout
```

Keep behavior differences readable.

Do not create many types prematurely.

---

# 15. Order System

Orders should be first-class entities.

Example:

```ts
interface Order {
  id: string;
  customerId: string;
  recipeId: string;
  status:
    | "queued"
    | "cooking"
    | "ready"
    | "picked-up"
    | "served"
    | "completed"
    | "cancelled";

  createdAt: number;
  cookingStartedAt?: number;
  readyAt?: number;
}
```

Maintain centralized queues.

Useful queues:

```text
pending cooking
currently cooking
ready for delivery
```

Provide debug visibility.

---

# 16. Recipe Definitions

Recipes must be data-driven.

Example:

```ts
interface RecipeDefinition {
  id: string;
  name: string;
  unlockLevel: number;

  baseCookTimeMs: number;

  basePrice: number;

  visualKey: string;

  ingredients?: Array<{
    ingredientId: string;
    amount: number;
  }>;
}
```

Initial recipes:

```text
Burger
Fries
Soda
```

Optional later:

```text
Pizza
Coffee
Cake
Sushi
```

Do not hard-code recipe behavior inside scenes.

---

# 17. Cooking Stations

Cooking stations should expose:

```ts
interface CookingStationState {
  id: string;
  stationType: string;
  level: number;

  slots: CookingSlot[];

  speedMultiplier: number;
}
```

Cooking slots allow upgrades such as:

```text
Level 1: 1 item
Level 2: faster
Level 3: 2 simultaneous items
```

Use data-driven upgrade definitions.

---

# 18. Staff Architecture

All staff should use explicit task-based behavior.

Do not write deeply nested conditionals such as:

```ts
if (...) {
  if (...) {
    if (...) {
```

Implement:

```text
task selection
task execution
task completion
```

Suggested task model:

```ts
type StaffTask =
  | CookTask
  | PickupFoodTask
  | DeliverFoodTask
  | CollectPaymentTask
  | CleanTableTask;
```

---

# 19. Chef AI

Chef states:

```text
Idle
AcquireOrder
MoveToStation
Cooking
MoveToCounter
DropFood
Idle
```

The chef should always select useful work when available.

When multiple orders exist, default policy:

```text
oldest order first
```

Later upgrades may unlock:

```text
parallel cooking
batch cooking
multiple chefs
```

---

# 20. Waiter AI

Waiter states:

```text
Idle
AcquireTask
MoveToPickup
Pickup
MoveToDestination
DropOff
Return
```

Priority order:

```text
1. deliver prepared food
2. collect payment
3. clean tables
```

Avoid starvation by tracking task age.

---

# 21. Task Reservation

This is important.

Multiple staff must not select the same task.

Use reservation:

```ts
interface ReservableTask {
  reservedBy?: StaffId;
}
```

A staff member reserves a task before moving toward it.

Release reservation if:

```text
task becomes invalid
staff disappears
customer leaves
path becomes impossible
```

---

# 22. Movement

Do not implement sophisticated pathfinding until required.

Use the simplest navigation compatible with the current restaurant geometry.

Priority:

```text
reliable > realistic
```

If grid navigation already exists, preserve it.

If obstacles matter, use a lightweight grid pathfinding algorithm.

Pathfinding should account for:

```text
walls
furniture
tables
kitchen objects
restaurant boundaries
```

Customers and staff may overlap slightly if necessary.

Do not build an expensive crowd simulation.

---

# 23. Economy

Use a central economy service.

Example:

```ts
interface EconomyState {
  coins: number;
  lifetimeRevenue: number;
  totalCustomersServed: number;
}
```

Functions:

```ts
canAfford(amount)
spend(amount)
earn(amount, source)
```

Do not directly mutate money from random systems.

All transactions should go through Economy.

This makes debugging and balancing easier.

---

# 24. Revenue Formula

Start simple.

Suggested:

```text
final price =
base recipe price
× recipe upgrade multiplier
× restaurant multiplier
× customer multiplier
```

Do not introduce complex modifiers initially.

---

# 25. Upgrade System

All upgrades must be data-driven.

Example:

```ts
interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;

  maxLevel: number;

  cost(level: number): number;

  apply(level: number): UpgradeEffect;
}
```

Avoid inline upgrade formulas scattered through code.

---

# 26. Initial Upgrade Categories

Chef:

```text
Cooking Speed
Cooking Capacity
```

Waiter:

```text
Movement Speed
Carry Capacity
```

Restaurant:

```text
Customer Spawn Rate
Table Capacity
Tips
```

Food:

```text
Recipe Value
```

Facilities:

```text
Kitchen Capacity
Serving Counter Capacity
```

---

# 27. Upgrade Cost Curve

Start with exponential growth:

```ts
cost = baseCost * Math.pow(growthRate, level);
```

Good initial range:

```text
growthRate = 1.5–1.9
```

Tune after playtesting.

Do not create a sophisticated economy simulator.

---

# 28. Restaurant Expansion

Expansion is one of the most important sources of visible progression.

Restaurant areas:

```text
Area 1 — Starter Cafe
Area 2 — Dining Extension
Area 3 — Premium Wing
```

Each locked area should be visibly present before unlocking.

Example:

```text
🔒 Expand
$1,500
```

Unlocking should:

```text
remove blocking wall/overlay
play animation
increase usable restaurant space
enable furniture/build spots
possibly unlock new content
```

The player should visually understand what they are saving toward.

---

# 29. Fixed Upgrades vs Free Furniture Placement

The existing project may support free furniture placement.

Preserve that system if functional.

However, progression-critical equipment should preferably use predefined upgrade locations.

For example:

```text
table upgrade pad
kitchen station upgrade pad
expansion gate
staff hiring station
```

Reason:

Free decoration is fun.

Core economy progression should remain understandable.

Use both systems.

---

# 30. Restaurant Zones

Define zones:

```text
entrance
dining
kitchen
service
expansion
```

Zone metadata should be accessible to AI systems.

Avoid hard-coded coordinate comparisons where possible.

---

# 31. Feedback / Juice

This is a priority.

A technically functioning restaurant that feels dead is not acceptable.

Implement satisfying feedback.

## Money

When customer pays:

```text
coin icon appears
floating +$12
small bounce
subtle sound
coin moves toward currency UI
```

## Upgrades

When upgrade purchased:

```text
button pop
object scale bounce
particles
brief glow
floating "LEVEL 3"
sound cue
```

## Cooking

Cooking station:

```text
progress indicator
small steam/spark effects
food appears when finished
```

## Serving

Delivery:

```text
food icon travels / appears
customer reaction bubble
```

## Expansion

Expansion unlock should feel significant:

```text
camera emphasis
dust/particle effect
object reveal
sound
```

---

# 32. Floating Text System

Create reusable floating text.

Examples:

```text
+$25
+3 REP
LEVEL UP!
FULL
WAITING
```

Do not create one-off implementations.

Suggested API:

```ts
feedback.showFloatingText({
  x,
  y,
  text: "+$25",
  type: "money",
});
```

---

# 33. Feedback Event Bus

Prefer gameplay events such as:

```text
CUSTOMER_ARRIVED
ORDER_CREATED
ORDER_READY
ORDER_SERVED
CUSTOMER_PAID
UPGRADE_PURCHASED
AREA_UNLOCKED
```

Visual/audio feedback can subscribe.

Simulation logic should not need direct knowledge of particle systems.

---

# 34. UI Principles

The UI should resemble a polished casual mobile game while remaining comfortable on desktop.

Always-visible HUD:

```text
Coins
Reputation / Level
Settings
```

Contextual UI:

```text
upgrade button
cost
current level
next benefit
```

Avoid giant developer-style panels during normal gameplay.

Developer/debug UI should be toggleable.

---

# 35. Upgrade UI

Every upgrade must communicate:

```text
Current state
Next state
Cost
```

Bad:

```text
Upgrade $300
```

Good:

```text
Chef Speed Lv.3

1.8s → 1.5s

Upgrade
$300
```

---

# 36. Number Formatting

Implement reusable compact formatting.

Examples:

```text
950
1.2K
15.4K
2.1M
```

Do not show ugly floating-point values.

---

# 37. Responsive Design

Primary design:

```text
desktop landscape
```

But do not make the game unusable on mobile.

Use:

```text
responsive canvas
scalable HUD
large click targets
touch-compatible interactions
```

Do not optimize portrait mobile until later.

---

# 38. Camera

Start with one restaurant camera.

Requirements:

```text
restaurant visible clearly
optional pan
optional limited zoom
no unnecessary camera complexity
```

If the restaurant grows larger:

```text
drag-to-pan
mouse wheel zoom
```

Keep UI screen-space independent from world camera.

---

# 39. Art Strategy

Do not block implementation waiting for perfect art.

Use a layered approach.

Phase 1:

```text
existing art
simple placeholders
consistent shapes
```

Phase 2:

```text
replace with coherent asset pack
```

Prefer one coherent visual family.

Do not randomly mix many incompatible asset packs.

---

# 40. Asset Manifest

Create centralized asset definitions.

Example:

```ts
export const AssetKeys = {
  CUSTOMER_REGULAR: "customer_regular",
  CHEF: "chef",
  WAITER: "waiter",
  TABLE_BASIC: "table_basic",
  BURGER: "food_burger",
} as const;
```

Avoid magic asset strings throughout the codebase.

---

# 41. Asset Import Workflow

Create:

```text
docs/ASSETS.md
```

Document:

```text
source pack
original filename
new filename
usage
```

Even though this is private, maintain basic provenance.

---

# 42. Audio

Add lightweight audio only after gameplay works.

Required categories:

```text
coin
upgrade
cooking complete
food served
area unlocked
button click
```

Optional:

```text
quiet background music
restaurant ambience
```

Provide volume controls.

Persist settings.

---

# 43. Save System

Save format must be versioned.

Example:

```ts
interface SaveGame {
  version: number;

  createdAt: number;
  savedAt: number;

  economy: EconomySave;
  progression: ProgressionSave;
  restaurant: RestaurantSave;
  staff: StaffSave[];
  settings: SettingsSave;
}
```

Use:

```ts
version: 1
```

initially.

---

# 44. Save Migration

Create:

```text
SaveMigrationService
```

Example:

```ts
migrate(save: unknown): SaveGame
```

Never assume old saves always match current schema.

Migration path:

```text
v1 → v2
v2 → v3
```

Keep migration code simple.

---

# 45. Autosave

Autosave on:

```text
major purchase
area unlock
staff hire
recipe unlock
periodic interval
page visibility change
```

Also retain manual save if currently present.

Avoid saving every frame.

---

# 46. Offline Progress

After core gameplay works, implement offline earnings.

Store:

```text
lastSavedAt
```

On load:

```text
elapsed = now - lastSavedAt
```

Cap offline duration initially:

```text
8 hours
```

Do not simulate every restaurant action individually.

Estimate revenue using a simplified model.

Example:

```ts
offlineRevenue =
  estimatedRevenuePerMinute *
  offlineMinutes *
  offlineEfficiency;
```

Initial:

```text
offlineEfficiency = 0.5
```

Display:

```text
Welcome back!

Away: 3h 24m
Earned: $4,820
```

---

# 47. Progression Level

Use restaurant reputation / XP.

Example:

```text
customers served
special customer satisfaction
area unlocks
```

grant XP.

Restaurant level unlocks:

```text
recipes
upgrades
decorations
new areas
```

Avoid dozens of progression resources.

---

# 48. Initial Content Plan

## Recipes

Tier 1:

```text
Burger
Fries
Soda
```

Tier 2:

```text
Pizza
Coffee
```

Tier 3:

```text
Cake
Deluxe Meal
```

Implement at least three initially.

---

# 49. Initial Expansion Sequence

Starter:

```text
2 tables
1 chef
1 waiter
1 cooking station
```

Then:

```text
Upgrade chef
↓
Add tables
↓
Hire/upgrade waiter
↓
Improve kitchen
↓
Unlock second area
↓
Add new recipe
↓
Handle more customers
↓
Unlock premium wing
```

---

# 50. Early Balance Target

First meaningful purchase:

```text
within 30–60 seconds
```

First visible upgrade:

```text
within 2 minutes
```

First area expansion:

```text
within 8–15 minutes
```

First major automation improvement:

```text
within 15–25 minutes
```

A full initial progression run:

```text
roughly 30–60 minutes
```

These are tuning targets, not strict requirements.

---

# 51. Avoid Dead Time

In the first 10 minutes, there should rarely be a period longer than ~20 seconds where:

```text
nothing happens
nothing can be upgraded
nothing changes
```

The early game should be active.

Later gameplay may become more idle.

---

# 52. Bottleneck Design

The game should deliberately alternate bottlenecks.

Example:

```text
too many customers
→ upgrade chef

food ready but not delivered
→ upgrade waiter

tables always full
→ buy tables

customers too slow to arrive
→ improve reputation / spawn rate

kitchen queue too long
→ upgrade cooking stations
```

The player should be able to identify bottlenecks visually.

---

# 53. Debug Overlay

Implement a developer overlay toggled by:

```text
F2
```

Show:

```text
FPS
customer count
active orders
ready orders
chef tasks
waiter tasks
revenue/min
average wait time
simulation speed
save version
```

Optional controls:

```text
+ money
spawn customer
speed x1
speed x2
speed x5
unlock next area
clear restaurant
```

This is essential for balancing and Agent development.

---

# 54. Simulation Speed

Debug-only:

```text
1x
2x
5x
10x
```

Prefer changing simulation clock scale rather than manually multiplying random timers.

---

# 55. Logging

Avoid noisy console logs.

Create a small structured debug logger.

Categories:

```text
customer
staff
order
economy
save
progression
```

Debug logging should be disabled by default.

---

# 56. Testing Strategy

Gameplay rules should be testable without Phaser.

Add tests for:

## Orders

```text
order created
order enters queue
order assigned
food completes
order delivered
order completes
```

## Economy

```text
cannot spend unavailable money
purchase subtracts correct amount
income increases money
upgrade cost correct
```

## Progression

```text
XP threshold
unlock rules
upgrade limits
```

## Staff

```text
task reservation prevents duplication
waiter prioritizes ready food
chef chooses oldest order
```

## Save

```text
round-trip serialization
migration
corrupted save fallback
```

## Offline progress

```text
elapsed time calculation
cap works
reward formula
```

---

# 57. Deterministic Tests

Inject RNG where randomness exists.

Do not directly call:

```ts
Math.random()
```

inside important gameplay logic.

Use:

```ts
interface RandomSource {
  next(): number;
}
```

This allows deterministic tests.

---

# 58. Error Recovery

The game must recover from invalid states.

Examples:

Customer table deleted while eating:

```text
cancel / relocate safely
```

Cooking station removed:

```text
return order to queue
```

Staff task target removed:

```text
release task
return to idle
```

Invalid save:

```text
backup corrupted save
start safe default state
```

Never allow one bad entity to crash the entire scene.

---

# 59. Performance Targets

Target:

```text
60 FPS desktop
```

Typical restaurant load:

```text
20–50 active customers
2–10 staff
dozens of furniture objects
```

Do not optimize for thousands of agents.

Avoid:

```text
expensive per-frame array scans
creating temporary objects every frame unnecessarily
pathfinding every frame
```

Use event-driven updates where sensible.

---

# 60. Customer Spawning

Do not continuously spawn without capacity awareness.

Spawn logic should consider:

```text
restaurant level
available seating
spawn interval
maximum waiting customers
```

Prevent entrance pileups.

---

# 61. Queueing

If tables are full, later add a visible entrance queue.

Initial implementation may simply reduce spawning.

Do not implement complex queue behavior before core service is stable.

---

# 62. Decorations

Preserve existing decoration system if present.

Decorations may contribute:

```text
attractiveness
small reputation multiplier
cosmetic variety
```

Avoid making decoration mandatory for core progression.

---

# 63. Furniture Placement

If the project already supports:

```text
place
move
remove
```

preserve it.

Improve:

```text
placement preview
valid/invalid highlighting
grid snapping
refund display
collision validation
```

Core operational furniture should communicate required access spaces.

---

# 64. Restaurant Rating

Optional lightweight system:

```text
1–5 stars
```

Derived from:

```text
reputation
service speed
decorations
customers served
```

Use as progression visualization rather than punishment.

---

# 65. Farm Expansion — Future Phase

Do NOT implement until the restaurant MVP is polished.

Future loop:

```text
Farm
  ↓
Ingredients
  ↓
Restaurant
  ↓
Money
  ↓
Farm upgrades
```

Possible crops:

```text
Wheat
Potato
Tomato
Strawberry
```

Animal products:

```text
Milk
Egg
```

Farm gameplay should remain simple.

No Stardew-style character movement.

---

# 66. Future Farm Model

Example:

```ts
interface FarmPlot {
  id: string;
  cropId?: string;

  plantedAt?: number;
  readyAt?: number;
}
```

Harvest based on timestamps.

Do not run background timers.

---

# 67. Future Ingredient Chains

Example:

```text
Wheat
→ Bread
→ Burger
```

```text
Potato
→ Fries
```

```text
Milk
→ Cheese
→ Pizza
```

The restaurant should remain the primary game.

The farm is support gameplay.

---

# 68. Social Features — Future Phase

Private friends-only functionality may later include:

```text
friend leaderboard
restaurant visits
restaurant screenshots
daily gifts
```

Do not implement real-time multiplayer unless specifically requested later.

---

# 69. Backend — Future Phase

Do not introduce a backend until local gameplay and save systems are stable.

When needed, use a minimal architecture.

Recommended:

```text
Node.js
TypeScript
Fastify or Hono
SQLite initially
```

Possible schema:

```text
users
save_games
friendships
leaderboard
```

For a few friends, SQLite is sufficient.

Do not introduce:

```text
Kubernetes
microservices
Redis
Kafka
distributed queues
```

unless a future requirement genuinely needs them.

---

# 70. Backend Save Strategy

Preferred API:

```text
GET /api/save
PUT /api/save
```

The server stores versioned game save snapshots.

Local save remains as fallback.

Use optimistic timestamp/version checks if necessary.

---

# 71. Authentication — Future

For private play, prefer simple auth.

Possible:

```text
invite code
simple username/password
Discord OAuth later
```

Do not implement auth during the first gameplay milestone.

---

# 72. Implementation Milestones

Execute in this order.

---

# Milestone 0 — Repository Audit

Before implementing new features:

* install dependencies
* run game
* build project
* inspect all major source files
* inspect current roadmap
* inspect existing docs
* inspect data files
* inspect save system
* identify currently functioning features
* identify dead/duplicate systems
* record findings

Create:

```text
docs/CURRENT_STATE.md
```

Include:

```text
working features
partially working features
broken features
architecture map
important technical debt
recommended reuse
```

Do not perform large rewrites yet.

---

# Milestone 1 — Stabilize Core Architecture

Goals:

* remove obvious broken code
* ensure build passes
* ensure save/load works
* introduce gameplay event bus if missing
* isolate simulation state from rendering where practical
* add IDs to persistent entities
* centralize economy
* centralize time abstraction
* add basic automated tests

Acceptance:

```text
game boots reliably
game build passes
existing restaurant loop still works
save reload works
```

---

# Milestone 2 — Complete Customer Service Loop

Implement or repair:

```text
enter
seat
order
cook
serve
eat
pay
leave
```

Add clear visual state feedback.

Acceptance test:

```text
spawn 20 customers sequentially

all eventually complete or safely leave
no stuck tables
no duplicate orders
no permanent staff deadlock
```

---

# Milestone 3 — Robust Staff Automation

Implement:

```text
staff task queue
task reservation
chef state machine
waiter state machine
recovery from invalid task
```

Acceptance:

```text
multiple orders work
multiple tables work
two waiters do not target same delivery
staff returns to idle correctly
```

---

# Milestone 4 — Economy and Upgrades

Implement:

```text
upgrade data definitions
upgrade panel
chef upgrades
waiter upgrades
restaurant upgrades
recipe value upgrades
```

Provide feedback animations.

Acceptance:

```text
player can earn money
buy upgrade
immediately observe improvement
save/reload preserves upgrade
```

---

# Milestone 5 — Restaurant Expansion

Implement:

```text
3 visible restaurant areas
locked areas
unlock price
unlock animation
additional build capacity
```

Acceptance:

```text
player progresses from starter area through all 3 sections
```

---

# Milestone 6 — Content Pass

Add at least:

```text
3+ recipes
3 customer types
2+ kitchen station variants
several table/decor variants
10+ upgrades
```

Everything should be data-driven.

---

# Milestone 7 — Juice Pass

Add:

```text
floating money
particles
upgrade animation
customer reactions
cooking feedback
serve feedback
expansion feedback
sound
UI polish
```

Acceptance:

The game should feel satisfying even when simply watched for 60 seconds.

---

# Milestone 8 — Balance Pass

Instrument:

```text
revenue/min
customer wait
orders/min
chef utilization
waiter utilization
table utilization
```

Tune progression.

Target:

```text
30–60 minute initial complete progression
```

Document final values in:

```text
docs/BALANCE.md
```

---

# Milestone 9 — Offline Progress

Implement:

```text
lastPlayed timestamp
offline estimate
offline reward modal
8-hour cap
```

Acceptance:

```text
closing game and changing test clock produces deterministic reward
```

---

# Milestone 10 — Asset Polish

Replace placeholders with a visually coherent asset set.

Do not alter gameplay while doing the art pass.

Maintain:

```text
docs/ASSETS.md
```

---

# Milestone 11 — Mobile / UX Pass

Improve:

```text
responsive layout
touch input
large controls
safe canvas scaling
```

Do not compromise desktop quality.

---

# Milestone 12 — Optional Farm

Only start after Milestones 0–11 are stable.

Build minimal:

```text
4 farm plots
Wheat
Potato
Milk
Egg
```

Integrate ingredients with restaurant recipes.

---

# 73. Agent Execution Workflow

For each milestone:

1. Read relevant source.
2. Write/update short implementation notes.
3. Implement.
4. Add tests.
5. Run tests.
6. Run typecheck.
7. Run production build.
8. Manually verify gameplay if browser automation is available.
9. Fix regressions.
10. Update documentation.
11. Commit if repository workflow permits.

Do not mark a milestone complete because code merely compiles.

Gameplay must work.

---

# 74. Definition of Done

A feature is done only when:

```text
implementation complete
types correct
tests added where appropriate
build passes
existing gameplay still works
save/load considered
edge cases considered
visual feedback exists where player-facing
documentation updated
```

---

# 75. AI Code Quality Rules

Prefer:

```text
small modules
explicit types
clear names
pure functions
data-driven definitions
event-driven communication
state machines
composition
```

Avoid:

```text
God classes
1,000+ line scene files
magic numbers
magic strings
hidden global state
duplicated timers
business logic inside button callbacks
deep inheritance
unnecessary generic frameworks
```

---

# 76. Scene Size Rule

If `GameScene.ts` becomes very large, extract responsibilities.

A Phaser scene should primarily orchestrate:

```text
creation
rendering
input
high-level coordination
```

It should not contain the entire restaurant simulation.

---

# 77. Configuration

Create centralized configuration for tunable values.

Example:

```text
src/data/balance.ts
```

Include:

```text
starting money
spawn timing
base prices
upgrade cost growth
offline cap
XP curve
```

Agents should not need to search the entire codebase to rebalance the game.

---

# 78. Content Registry

Provide central registries:

```ts
recipesById
furnitureById
customersById
upgradesById
```

Use typed IDs when practical.

Fail loudly during development if referenced content does not exist.

---

# 79. Validation

Add startup validation for data definitions.

Detect:

```text
duplicate IDs
missing assets
negative costs
invalid unlock levels
missing recipe references
invalid upgrade targets
```

Development should fail early.

---

# 80. Save Integrity

Before writing save:

```text
validate
serialize
```

When loading:

```text
parse
validate
migrate
fallback
```

Never trust raw localStorage data.

---

# 81. Balance Instrumentation

Create debug metrics:

```text
customers served / minute
revenue / minute
average service time
average kitchen wait
average waiter wait
table occupancy
chef utilization
waiter utilization
```

Use these to detect bottlenecks.

---

# 82. Game Feel Guidelines

Animation timing should generally be snappy.

UI button:

```text
100–200ms
```

coin pop:

```text
300–600ms
```

upgrade bounce:

```text
200–400ms
```

Do not make routine interactions feel slow.

Customer walking should be readable without feeling sluggish.

---

# 83. Visual Hierarchy

The player's eye should easily distinguish:

```text
customer
staff
food
money
upgrade opportunity
locked expansion
```

Do not overload the screen with text.

Use icons where possible.

---

# 84. Tutorial

Do not build a complex scripted tutorial.

Use contextual prompts:

```text
Hire a chef
↓
Serve your first customer
↓
Upgrade the grill
↓
Add another table
↓
Unlock the next area
```

Dismiss prompts permanently once completed.

Persist tutorial state.

---

# 85. First 10 Minutes Experience

Aim for:

Minute 0:

```text
Restaurant already functions at basic level.
```

Minute 1:

```text
First earnings.
```

Minute 2–3:

```text
First meaningful upgrade.
```

Minute 4–6:

```text
Visible bottleneck appears.
```

Minute 6–10:

```text
Player solves bottleneck and approaches first expansion.
```

---

# 86. Restart / New Game

Keep a safe reset mechanism.

Require confirmation.

Optionally export existing save before reset in development mode.

---

# 87. Developer Cheats

Debug only:

```text
give $100
give $10K
spawn 10 customers
unlock all recipes
unlock next area
set restaurant level
speed simulation
clear save
```

Do not expose accidentally in production UI.

---

# 88. Browser Lifecycle

Handle:

```text
visibilitychange
beforeunload where appropriate
```

Save when page becomes hidden.

Pause or reduce unnecessary rendering while hidden.

Simulation should correctly resume.

---

# 89. Accessibility Basics

At minimum:

```text
UI text should remain readable
do not rely exclusively on color
buttons should have clear labels/tooltips
support mute
```

Full accessibility compliance is not required for this private project, but avoid obvious barriers.

---

# 90. Future Multiplayer Constraint

Do not couple simulation to localStorage.

Persistence should be behind an abstraction.

Example:

```ts
interface SaveRepository {
  load(): Promise<SaveGame | null>;
  save(save: SaveGame): Promise<void>;
}
```

Implement:

```text
LocalSaveRepository
```

initially.

Future:

```text
RemoteSaveRepository
```

This allows backend migration later.

---

# 91. Future Backend Constraint

Do not trust client timestamps for competitive features.

However, because this is a private friends game, server-authoritative economic simulation is unnecessary initially.

Keep design simple.

---

# 92. Package Policy

Before adding a dependency:

Ask:

```text
Can this be implemented cleanly in <150 lines?
```

If yes, prefer local code.

Avoid dependency bloat.

Reasonable dependencies include:

```text
Phaser
test framework
schema validation library if already present or clearly valuable
```

Do not add UI frameworks merely for one panel.

---

# 93. Do Not Replace Phaser

The project already uses Phaser.

Do not migrate to:

```text
Unity
Godot
Pixi
React canvas
Three.js
```

unless explicitly instructed.

---

# 94. Do Not Rebuild Everything

Existing functioning systems are assets.

Refactor incrementally.

When replacing a subsystem:

1. understand it
2. create tests if possible
3. implement replacement
4. verify behavior
5. remove old code

Never perform speculative mass rewrites.

---

# 95. Priority Order When Tradeoffs Appear

Use:

```text
1. Game works
2. Game is fun
3. Game is understandable
4. Game is maintainable
5. Game looks polished
6. Architecture elegance
```

Never sacrifice working gameplay solely for theoretical purity.

---

# 96. Bug Priority

P0:

```text
crash
save corruption
cannot progress
infinite money
entities permanently stuck
```

P1:

```text
incorrect economy
customer loop breaks
staff deadlock
upgrade not persisted
```

P2:

```text
visual glitches
minor UI issue
small animation bug
```

Fix P0/P1 before adding content.

---

# 97. Required Documentation at Completion

Repository should eventually contain:

```text
README.md
docs/
  AI_PROGRESS.md
  ARCHITECTURE.md
  GAME_DESIGN.md
  BALANCE.md
  ASSETS.md
  CURRENT_STATE.md
```

README should contain:

```text
how to install
how to run
how to test
controls
basic gameplay
debug controls
project structure
```

---

# 98. Recommended Final Architecture

Target approximately:

```text
src/
├── main.ts
│
├── scenes/
│   ├── BootScene.ts
│   └── GameScene.ts
│
├── simulation/
│   ├── RestaurantSimulation.ts
│   ├── SimulationClock.ts
│   │
│   ├── customers/
│   ├── staff/
│   ├── orders/
│   ├── cooking/
│   ├── economy/
│   └── progression/
│
├── systems/
│   ├── FurniturePlacementSystem.ts
│   ├── NavigationSystem.ts
│   ├── FeedbackSystem.ts
│   ├── AudioSystem.ts
│   └── DebugSystem.ts
│
├── entities/
│   ├── CustomerView.ts
│   ├── StaffView.ts
│   └── FurnitureView.ts
│
├── data/
│   ├── balance.ts
│   ├── recipes.ts
│   ├── customers.ts
│   ├── furniture.ts
│   ├── upgrades.ts
│   └── progression.ts
│
├── persistence/
│   ├── SaveGame.ts
│   ├── SaveRepository.ts
│   ├── LocalSaveRepository.ts
│   └── SaveMigrationService.ts
│
├── ui/
│   ├── HUD.ts
│   ├── UpgradePanel.ts
│   ├── UnlockPanel.ts
│   └── OfflineRewardModal.ts
│
└── utils/
```

Again: adapt rather than force this layout.

---

# 99. First Autonomous Task

Begin now with Milestone 0.

Perform the following without asking for permission:

1. Inspect entire repository structure.
2. Read all existing documentation.
3. Read all gameplay systems.
4. Run the current game.
5. Run build/test/typecheck commands.
6. Identify existing working restaurant flow.
7. Identify systems that already implement requirements from this document.
8. Identify redundant or unfinished code.
9. Create `docs/CURRENT_STATE.md`.
10. Create/update `docs/AI_PROGRESS.md`.
11. Create a concrete implementation checklist for Milestones 1–3.
12. Begin Milestone 1 immediately unless a serious repository-level blocker exists.

Do not merely produce a plan.

Start implementing.

---

# 100. Autonomous Completion Instruction

Continue milestone by milestone.

Do not stop after making scaffolding.

Do not stop after generating TODO comments.

Do not stop because one milestone is large.

Break work into smaller internal tasks and continue.

When encountering a defect:

```text
investigate
fix
test
continue
```

When encountering missing visual assets:

```text
use a reasonable placeholder
record it in ASSETS.md
continue
```

When encountering an unclear balance value:

```text
choose a reasonable default
record it in BALANCE.md
continue
```

When encountering existing implementation that conflicts with this document:

```text
prefer preserving working behavior
adapt this plan
record the decision in ARCHITECTURE.md
continue
```

At all times keep the repository buildable and playable.

The final goal is not merely clean source code.

The final goal is:

> a polished, satisfying, cozy restaurant-management game that can be opened in a browser and enjoyed immediately.
