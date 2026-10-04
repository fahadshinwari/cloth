import { DEFAULT_LOCALE, LOCALES, type Locale } from "../constants";
import en from "./dictionaries/en.json";
import faAF from "./dictionaries/fa-AF.json";
import ps from "./dictionaries/ps.json";

export type Dictionary = typeof en;

const DICTIONARIES: Record<Locale, Dictionary> = {
  en,
  "fa-AF": faAF as Dictionary,
  ps: ps as Dictionary,
};

/**
 * Resolve a nested "a.b.c" key against the dictionary.
 * Falls back to English, then to the raw key so missing translations
 * are visible instead of silently blank.
 */
export function translate(dict: Dictionary, key: string, vars?: Record<string, string | number>): string {
  const resolve = (d: Dictionary): string | undefined => {
    let node: unknown = d;
    for (const part of key.split(".")) {
      if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
        node = (node as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return typeof node === "string" ? node : undefined;
  };

  let text = resolve(dict) ?? resolve(DICTIONARIES[DEFAULT_LOCALE]) ?? key;

  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }

  return text;
}

export function getDictionary(locale: Locale): Dictionary {
  const dict = DICTIONARIES[locale];
  if (dict) return dict;
  return DICTIONARIES[DEFAULT_LOCALE];
}

/** Creates a bound `t` function for a locale. Usable in server components. */
export function getTranslator(locale: Locale) {
  const dict = getDictionary(locale);
  return (key: string, vars?: Record<string, string | number>) => translate(dict, key, vars);
}

export type Translator = ReturnType<typeof getTranslator>;

/** Validates that every locale has a dictionary at build/dev time. */
export function assertDictionariesRegistered(): void {
  for (const locale of LOCALES) {
    if (!DICTIONARIES[locale]) {
      throw new Error(`Missing dictionary for locale: ${locale}`);
    }
  }
}
