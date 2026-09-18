/**
 * Centralized time abstraction for deterministic gameplay. Gameplay logic reads time
 * through a GameClock instead of calling Date.now()/performance.now()
 * directly, so timers can be tested and scaled deliberately.
 */

export interface GameClock {
  /** Current simulation time in milliseconds. */
  now(): number;
}

/** Real wall-clock ms (Date.now). Used for persistence/offline systems. */
export class WallClock implements GameClock {
  now(): number {
    return Date.now();
  }
}

/**
 * Deterministic clock for headless tests: only advances when told to.
 */
export class ManualClock implements GameClock {
  private currentMs: number;

  constructor(startMs = 0) {
    this.currentMs = startMs;
  }

  now(): number {
    return this.currentMs;
  }

  advance(ms: number): void {
    this.currentMs += ms;
  }

  set(ms: number): void {
    this.currentMs = ms;
  }
}

/**
 * Phaser scene-time adapter. The scene's update loop already receives a
 * monotonic ms timestamp; this feeds it into the clock interface. Debug speed
 * changes would scale the delta upstream in the scene loop, so the
 * simulation itself remains oblivious to the scale factor.
 */
export class SceneClock implements GameClock {
  private currentMs = 0;

  now(): number {
    return this.currentMs;
  }

  /** Called by the scene each update with Phaser's time value. */
  setNow(ms: number): void {
    this.currentMs = ms;
  }
}
