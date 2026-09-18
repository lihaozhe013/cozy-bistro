/**
 * Central font stacks. Phaser canvas text resolves each glyph through the
 * family list, so appending CJK families after the Latin ones keeps Latin
 * rendering unchanged (Arial/Georgia/Consolas) while Chinese glyphs use the
 * operating system's CJK font instead of rendering tofu boxes.
 */

const CJK = '"Microsoft YaHei","PingFang SC","Noto Sans SC","Source Han Sans SC"';

export const FONTS = {
  /** Default UI text (was: Arial, Helvetica, sans-serif). */
  ui: `Arial, Helvetica, ${CJK}, sans-serif`,
  /** Display/heading text (was: Arial, sans-serif or bare Arial). */
  display: `Arial, ${CJK}, sans-serif`,
  /** Title signage (was: Georgia, serif). */
  serif: `Georgia, "Songti SC", SimSun, ${CJK}, serif`,
  /** Diagnostics overlay (was: Consolas, monospace). */
  mono: `Consolas, "Courier New", monospace`,
};
