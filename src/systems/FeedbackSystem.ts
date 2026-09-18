import Phaser from "phaser";
import { FONTS } from "../i18n/fonts";

/**
 * Reusable visual feedback (master_plan §31/§32): floating text, scale
 * bounces, and small particle bursts. One implementation, referenced by type
 * tone; everything is tween-based and self-destructing so callers never have
 * to manage lifetimes.
 */

export type FloatingTextTone = "money" | "rep" | "level" | "info" | "warn";

const toneStyles: Record<FloatingTextTone, { color: string; size: number; rise: number }> = {
  money: { color: "#2e7d32", size: 17, rise: 46 },
  rep: { color: "#c58a1f", size: 15, rise: 40 },
  level: { color: "#8f4fb0", size: 19, rise: 54 },
  info: { color: "#fff5dc", size: 14, rise: 34 },
  warn: { color: "#e2685e", size: 15, rise: 38 },
};

export class FeedbackSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Container,
    private readonly depth: number,
  ) {}

  showFloatingText(options: { x: number; y: number; text: string; tone?: FloatingTextTone }): void {
    const { x, y, text, tone = "info" } = options;
    const style = toneStyles[tone];
    const label = this.scene.add
      .text(x, y, text, {
        fontFamily: FONTS.display,
        fontSize: `${style.size}px`,
        fontStyle: "bold",
        color: style.color,
        stroke: "#3b2a21",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(this.depth);
    this.layer.add(label);
    this.scene.tweens.add({
      targets: label,
      y: y - style.rise,
      alpha: 0,
      duration: 620,
      ease: "Cubic.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  showScaleBounce(target: Phaser.GameObjects.Container | Phaser.GameObjects.Image): void {
    const base = target.scale;
    this.scene.tweens.chain({
      targets: target,
      tweens: [
        { scale: base * 1.22, duration: 110, ease: "Quad.easeOut" },
        { scale: base, duration: 180, ease: "Back.easeOut" },
      ],
    });
  }

  /** Cheap radial sparkle burst without a texture atlas (plan §31 "particles"). */
  showBurst(x: number, y: number, color = 0xffd966, count = 10, radius = 34): void {
    const graphics = this.scene.add.graphics().setDepth(this.depth);
    this.layer.add(graphics);
    const angleStep = (Math.PI * 2) / count;
    const state = { t: 0 };
    graphics.fillStyle(color, 1);
    this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: 430,
      ease: "Cubic.easeOut",
      onUpdate: () => {
        graphics.clear();
        for (let index = 0; index < count; index += 1) {
          const angle = index * angleStep + state.t * 0.6;
          const distance = radius * state.t;
          const px = x + Math.cos(angle) * distance;
          const py = y + Math.sin(angle) * distance * 0.7;
          const size = 3.2 * (1 - state.t);
          graphics.fillRect(px - size / 2, py - size / 2, size, size);
        }
        graphics.setAlpha(1 - state.t);
      },
      onComplete: () => graphics.destroy(),
    });
  }
}
