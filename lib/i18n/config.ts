import type { Locale } from "../constants";

export interface LocaleConfig {
  code: Locale;
  label: string;
  /** English label for admins. */
  englishLabel: string;
  dir: "ltr" | "rtl";
  /** BCP-47 tag used for Intl APIs. */
  intlLocale: string;
}

export const LOCALE_CONFIGS: Record<Locale, LocaleConfig> = {
  en: { code: "en", label: "English", englishLabel: "English", dir: "ltr", intlLocale: "en-US" },
  "fa-AF": {
    code: "fa-AF",
    label: "دری",
    englishLabel: "Dari",
    dir: "rtl",
    intlLocale: "fa-AF",
  },
  ps: { code: "ps", label: "پښتو", englishLabel: "Pashto", dir: "rtl", intlLocale: "ps-AF" },
};

export const LOCALE_LIST: LocaleConfig[] = Object.values(LOCALE_CONFIGS);

export function getLocaleConfig(locale: Locale): LocaleConfig {
  return LOCALE_CONFIGS[locale];
}

export function getDirection(locale: Locale): "ltr" | "rtl" {
  return LOCALE_CONFIGS[locale].dir;
}
