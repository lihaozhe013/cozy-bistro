import { beforeEach, describe, expect, it, vi } from "vitest";
import { containsCJK, getLanguage, setLanguage, t, translateLegacyText, type MessageKey } from "../i18n";
import { formatMoney, shouldBreakByCharacter } from "../i18n/format";
import { contentDescription, contentName } from "../i18n/content";
import { gameEvents } from "../simulation/EventBus";

describe("i18n core", () => {
  beforeEach(() => {
    setLanguage("zh");
  });

  it("defaults to Chinese when no stored preference exists", () => {
    expect(getLanguage()).toBe("zh");
    expect(t("gamePanel.newGame")).toBe("新游戏");
  });

  it("switches locales through setLanguage", () => {
    setLanguage("en");
    expect(t("gamePanel.newGame")).toBe("New Game");
    setLanguage("zh");
    expect(t("gamePanel.newGame")).toBe("新游戏");
  });

  it("interpolates params", () => {
    expect(t("staff.hireChef", { money: "$120" })).toBe("雇厨师 $120");
    setLanguage("en");
    expect(t("staff.hireChef", { money: "$120" })).toBe("Hire Chef $120");
  });

  it("leaves unknown tokens untouched instead of blanking them", () => {
    expect(t("stats.savedToSlot", { slot: 2 })).toContain("2");
    expect(t("stats.savedToSlot", {})).toContain("{slot}");
  });

  it("returns the raw key and warns once for unknown keys", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(t("hud.missingTofuKey" as MessageKey)).toBe("hud.missingTofuKey");
    expect(t("hud.missingTofuKey" as MessageKey)).toBe("hud.missingTofuKey");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("emits a language-changed event on switch", () => {
    const seen: string[] = [];
    const off = gameEvents.on("language-changed", ({ locale }) => seen.push(locale));
    setLanguage("en");
    setLanguage("en");
    setLanguage("zh");
    off();
    expect(seen).toEqual(["en", "zh"]);
  });
});

describe("legacy text fallback", () => {
  it("maps exact English UI strings back to the active locale", () => {
    expect(translateLegacyText("Ready")).toBe("就绪");
    expect(translateLegacyText("Rent +$30")).toBe("Rent +$30");
    setLanguage("en");
    expect(translateLegacyText("Ready")).toBe("Ready");
  });
});

describe("CJK helpers", () => {
  it("detects CJK ranges including fullwidth punctuation", () => {
    expect(containsCJK("雇佣厨师")).toBe(true);
    expect(containsCJK("Hire Chef $120")).toBe(false);
    expect(containsCJK("金额:＄5")).toBe(true);
  });

  it("enables character wrapping only for CJK text", () => {
    expect(shouldBreakByCharacter("新游戏")).toBe(true);
    expect(shouldBreakByCharacter("New Game")).toBe(false);
  });
});

describe("content catalog", () => {
  beforeEach(() => {
    setLanguage("zh");
  });

  it("translates canonical content names for Chinese", () => {
    expect(contentName("Butter Toast")).toBe("黄油吐司");
    expect(contentName("Round Table")).toBe("圆桌");
    expect(contentName("North Room")).toBe("北侧包间");
  });

  it("keeps English canonical names when locale is English", () => {
    setLanguage("en");
    expect(contentName("Butter Toast")).toBe("Butter Toast");
    expect(contentDescription("Chefs finish dishes faster.")).toBe("Chefs finish dishes faster.");
  });

  it("falls back to the canonical string for unknown content", () => {
    expect(contentName("Some Future Dish")).toBe("Some Future Dish");
    expect(contentDescription("Unknown description.")).toBe("Unknown description.");
  });
});

describe("money formatting", () => {
  it("uses the shared dollar style in both locales", () => {
    expect(formatMoney(120)).toBe("$120");
    expect(formatMoney(-45)).toBe("$-45");
  });
});
