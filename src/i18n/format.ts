import { containsCJK, getLanguage } from "./index";

/**
 * Single hook for money rendering. The game uses one currency ("$") in both
 * locales, so the value stays identical while call sites keep a semantic
 * function name instead of inline templates.
 */
export function formatMoney(amount: number): string {
  return `$${amount}`;
}

/** Locale-aware date/time rendering for save timestamps and the ledger. */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(getLanguage() === "zh" ? "zh-CN" : "en-US");
}

/**
 * Phaser's plain word wrap only breaks at spaces; CJK text has none and would
 * overflow the box. With advanced wrapping enabled Phaser breaks between any
 * two characters, which is the correct behavior for Chinese (and harmless for
 * English unless a word alone exceeds the width, in which case char-breaking
 * beats clipping).
 */
export function shouldBreakByCharacter(text: string): boolean {
  return containsCJK(text);
}
