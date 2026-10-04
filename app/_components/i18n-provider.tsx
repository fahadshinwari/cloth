"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { getDictionary, translate } from "@/lib/i18n/dictionaries";
import type { Locale } from "@/lib/constants";

interface I18nContextValue {
  locale: Locale;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Client-side i18n. Server pages resolve the locale from the cookie and pass
 * it down; client components (forms etc.) read it via useI18n() and translate
 * with the same dictionaries + fallback-to-English behaviour as the server.
 */
export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
} {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used inside <I18nProvider>");
  }
  const dict = getDictionary(ctx.locale);
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(dict, key, vars);
  return { locale: ctx.locale, t };
}
