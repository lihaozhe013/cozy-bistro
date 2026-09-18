import { en, type Dictionary, type MessageKey } from "./locales/en";
import { zh } from "./locales/zh";
import { gameEvents } from "../simulation/EventBus";

export type { MessageKey } from "./locales/en";
export type Locale = "en" | "zh";

/**
 * Language preference is a device-level setting (like sound volume), stored
 * outside gameplay saves so switching language never dirties a save file.
 * Chinese is the default because it is the primary audience language.
 */
const STORAGE_KEY = "cozy-bistro-language";

const catalogs: Record<Locale, Dictionary> = { en, zh };

function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "zh";
}

function readStoredLocale(): Locale {
  try {
    // `window` guard keeps Node (vitest) from touching its experimental
    // localStorage polyfill, which emits a runtime warning on access.
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (isLocale(stored)) {
      return stored;
    }
  } catch {
    // Storage unavailable (private mode): fall through to default.
  }
  return "zh";
}

let active: Locale = readStoredLocale();

export function getLanguage(): Locale {
  return active;
}

export function isChinese(): boolean {
  return active === "zh";
}

export function setLanguage(next: Locale): void {
  if (next === active) {
    return;
  }
  active = next;
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  } catch {
    // Persisting failed; the session still switches.
  }
  syncDocument();
  gameEvents.emit("language-changed", { locale: next });
}

export function toggleLanguage(): void {
  setLanguage(active === "zh" ? "en" : "zh");
}

/** Keeps <html lang> and the tab title in sync with the active locale. */
function syncDocument(): void {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.lang = active === "zh" ? "zh-CN" : "en";
  document.title = t("app.name");
}

syncDocument();

type Params = Record<string, string | number>;

function lookup(catalog: Dictionary, key: string): string | undefined {
  let node: unknown = catalog;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) {
      return undefined;
    }
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

const warned = new Set<string>();

/**
 * Always-English text, used for values persisted into saves or exports
 * (transaction ledger). Display sites run them through translateLegacyText.
 */
export function tEn(key: MessageKey, params?: Params): string {
  const text = lookup(catalogs.en, key) ?? key;
  return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match)) : text;
}

/**
 * Translate a message key. Falls back to the English catalog (then to the raw
 * key) when the active locale is missing an entry, warning once per key.
 */
export function t(key: MessageKey, params?: Params): string {
  let text = lookup(catalogs[active], key);
  if (text === undefined) {
    const fallback = lookup(catalogs.en, key);
    if (fallback === undefined && !warned.has(key)) {
      warned.add(key);
      console.warn(`[i18n] missing message key "${key}" for locale "${active}"`);
    }
    text = fallback ?? key;
  }
  if (!params) {
    return text;
  }
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

/** True when the string contains characters that need CJK-capable fonts/wrapping. */
export function containsCJK(text: string): boolean {
  return /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(text);
}

let reverseEn: Map<string, string> | undefined;

function buildReverseEn(catalog: unknown, prefix: string, into: Map<string, string>): void {
  for (const [key, value] of Object.entries(catalog as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      into.set(value, path);
    } else if (typeof value === "object" && value !== null) {
      buildReverseEn(value, path, into);
    }
  }
}

/**
 * Best-effort translation of exact-match English UI strings. Used for text
 * that is persisted or stored outside the message pipeline (legacy status
 * bubbles, transaction log history). Interpolated strings usually do not
 * match and are returned unchanged.
 */
export function translateLegacyText(text: string): string {
  if (active === "en") {
    return text;
  }
  reverseEn ??= (() => {
    const map = new Map<string, string>();
    buildReverseEn(catalogs.en, "", map);
    return map;
  })();
  const key = reverseEn.get(text);
  return key ? t(key as MessageKey) : text;
}
