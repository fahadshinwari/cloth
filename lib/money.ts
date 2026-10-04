import { CURRENCIES, DEFAULT_CURRENCY, type Currency } from "./constants";

/**
 * Multi-currency money helpers.
 *
 * RULE: AFN and USD are NEVER combined mathematically. Every amount belongs
 * to exactly one currency, and all sums/aggregations are per-currency.
 * Amounts are stored as integer minor units (e.g. cents for USD, pul for
 * AFN — 1 AFN = 100 pul) so arithmetic is exact and free of float drift.
 */

export const MINOR_UNITS: Record<Currency, number> = { AFN: 100, USD: 100 };

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

/**
 * Converts a user-entered decimal amount (e.g. "1250.50") into integer
 * minor units for the given currency. Returns null when unparseable.
 */
export function toMinorUnits(amount: string | number, currency: Currency = DEFAULT_CURRENCY): number | null {
  const trimmed = String(amount).trim().replace(/,/g, "");
  if (trimmed === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;

  const minor = Math.round(value * MINOR_UNITS[currency]);
  if (!Number.isSafeInteger(minor)) return null;
  return minor;
}

/** Converts integer minor units back to a decimal amount for display. */
export function fromMinorUnits(minor: number, currency: Currency = DEFAULT_CURRENCY): number {
  return minor / MINOR_UNITS[currency];
}

/** Formats minor units as a plain decimal string for `<input>` defaults. */
export function formatMinorForInput(minor: number, currency: Currency = DEFAULT_CURRENCY): string {
  return fromMinorUnits(minor, currency).toFixed(currency === "AFN" ? 0 : 2);
}

/**
 * Sums a list of `{ currency, amountMinor }` records into per-currency
 * totals. Returns one bucket per supported currency so results can always
 * be displayed side by side — never merged into a single number.
 */
export interface CurrencyTotals {
  AFN: number;
  USD: number;
}

export function sumByCurrency(entries: Array<{ currency: Currency; amountMinor: number }>): CurrencyTotals {
  const totals: CurrencyTotals = { AFN: 0, USD: 0 };
  for (const entry of entries) {
    if (!isCurrency(entry.currency)) continue;
    totals[entry.currency] += entry.amountMinor;
  }
  return totals;
}

/**
 * Canonical rendering of a per-currency total, e.g. "AFN 500,000" / "USD 12,000".
 * Kept separate from lib/i18n/format so business modules can label totals
 * explicitly with their currency and never imply a combined figure.
 */
export function formatMinorAmount(minor: number, currency: Currency): string {
  const units = fromMinorUnits(minor, currency);
  const fractionDigits = currency === "AFN" ? 0 : 2;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Math.abs(units));
  return `${units < 0 ? "-" : ""}${currency} ${formatted}`;
}
