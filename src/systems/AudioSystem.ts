/**
 * Tiny synthesized sound effects (master_plan §42). WebAudio oscillators mean
 * zero audio assets and zero dependencies; the context is created lazily on
 * the first user gesture because browsers block autoplay.
 */

export type SoundName = "coin" | "upgrade" | "unlock" | "ready" | "click";

interface Recipe {
  notes: Array<{ freq: number; at: number; duration: number; gain: number }>;
  type: OscillatorType;
}

const recipes: Record<SoundName, Recipe> = {
  coin: {
    type: "triangle",
    notes: [
      { freq: 1318, at: 0, duration: 0.07, gain: 0.16 },
      { freq: 1760, at: 0.06, duration: 0.1, gain: 0.16 },
    ],
  },
  upgrade: {
    type: "sine",
    notes: [
      { freq: 523, at: 0, duration: 0.09, gain: 0.2 },
      { freq: 659, at: 0.08, duration: 0.09, gain: 0.2 },
      { freq: 784, at: 0.16, duration: 0.16, gain: 0.22 },
    ],
  },
  unlock: {
    type: "sine",
    notes: [
      { freq: 392, at: 0, duration: 0.12, gain: 0.22 },
      { freq: 523, at: 0.11, duration: 0.12, gain: 0.22 },
      { freq: 659, at: 0.22, duration: 0.12, gain: 0.22 },
      { freq: 784, at: 0.33, duration: 0.26, gain: 0.24 },
    ],
  },
  ready: {
    type: "square",
    notes: [{ freq: 880, at: 0, duration: 0.06, gain: 0.07 }],
  },
  click: {
    type: "sine",
    notes: [{ freq: 620, at: 0, duration: 0.04, gain: 0.08 }],
  },
};

export class AudioSystem {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private unlocked = false;
  volume = 0.5;

  constructor() {
    this.applyVolume();
  }

  /** Must be called from a user gesture handler at least once. */
  unlock(): void {
    if (this.unlocked) {
      return;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        return;
      }
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.applyVolume();
      this.unlocked = true;
    } catch {
      // Audio unavailable: game stays fully playable.
    }
  }

  play(name: SoundName): void {
    if (!this.context || !this.master || this.volume <= 0) {
      return;
    }
    if (this.context.state === "suspended") {
      void this.context.resume();
    }
    const recipe = recipes[name];
    const now = this.context.currentTime;
    for (const note of recipe.notes) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = recipe.type;
      oscillator.frequency.value = note.freq;
      gain.gain.setValueAtTime(0.0001, now + note.at);
      gain.gain.exponentialRampToValueAtTime(note.gain, now + note.at + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.duration);
      oscillator.connect(gain).connect(this.master);
      oscillator.start(now + note.at);
      oscillator.stop(now + note.at + note.duration + 0.02);
    }
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    this.applyVolume();
  }

  private applyVolume(): void {
    if (this.master) {
      this.master.gain.value = this.volume;
    }
  }
}
