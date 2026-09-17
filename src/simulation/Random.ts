/**
 * Injectable randomness for deterministic simulation (master_plan §57).
 *
 * Helpers mirror the Phaser math utilities the systems used previously so
 * behaviour is preserved when a `SeededRandom` or `PhaserRandom` source is
 * supplied.
 */

export interface RandomSource {
  /** Uniform float in [0, 1). */
  next(): number;
}

/** Deterministic 32-bit PRNG (mulberry32). Same seed -> same sequence. */
export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed = 0x9e3779b9) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/** Default source delegating to Math.random (non-deterministic). */
export class GlobalRandom implements RandomSource {
  next(): number {
    return Math.random();
  }
}

const sharedGlobalRandom = new GlobalRandom();

/** The source used when a system is constructed without an explicit RNG. */
export function defaultRandomSource(): RandomSource {
  return sharedGlobalRandom;
}

export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

/** Uniform integer in [min, max], inclusive — matches Phaser.Math.Between. */
export function between(random: RandomSource, min: number, max: number): number {
  return Math.floor(clamp(random.next(), 0, 0.9999999999) * (max - min + 1) + min);
}

/** Uniform random element — matches Phaser.Utils.Array.GetRandom. */
export function pick<T>(random: RandomSource, items: readonly T[]): T {
  return items[Math.floor(random.next() * items.length)];
}
