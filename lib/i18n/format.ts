import { DEFAULT_CURRENCY, type Currency } from "../constants";
import { getLocaleConfig } from "./config";
import type { Locale } from "../constants";

export { formatMinorAmount } from "../money";

/**
 * Formats a money amount in its ORIGINAL currency.
 * Never converts — amounts are stored and displayed in the currency
 * they were entered in (AFN or USD).
 */
export function formatCurrency(
  amount: number,
  currency: Currency = DEFAULT_CURRENCY,
  locale: Locale = "en",
): string {
  const { intlLocale } = getLocaleConfig(locale);

  try {
    return new Intl.NumberFormat(intlLocale, {
      style: "currency",
      currency,
      currencyDisplay: "code",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Formats a date. Persian locales (Dari) use the Solar Hijri calendar,
 * Pashto stays Gregorian for consistency with business records.
 */
export function formatDate(
  value: Date | string | number,
  locale: Locale = "en",
  options?: Intl.DateTimeFormatOptions,
): string {
  const { intlLocale } = getLocaleConfig(locale);
  const date = value instanceof Date ? value : new Date(value);

  try {
    return new Intl.DateTimeFormat(intlLocale, {
      dateStyle: "medium",
      timeStyle: "short",
      ...(options ?? {}),
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function formatNumber(value: number, locale: Locale = "en"): string {
  const { intlLocale } = getLocaleConfig(locale);
  try {
    return new Intl.NumberFormat(intlLocale).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Formats an amount for `<input type="number">`-style editing
 * (always dot decimal, no grouping).
 */
export function formatAmountForInput(amount: number): string {
  return String(amount);
}
