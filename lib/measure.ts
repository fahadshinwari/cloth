/**
 * Meter-based measure helpers (Module 4).
 *
 * Cloth quantities are stored as integer MILLIMETERS of cloth so that
 * fractional meters (e.g. 12.75 m) add up exactly without float drift —
 * the same integer-minor-unit approach used for money in lib/money.ts.
 */

export const MM_PER_METER = 1000;

/** Converts a user-entered decimal meter value ("12.75") to integer mm. */
export function toMillimeters(meters: string | number): number | null {
  const trimmed = String(meters).trim().replace(/,/g, "");
  if (trimmed === "") return null;
  if (!/^-?\d+(\.\d{1,3})?$/.test(trimmed)) return null;

  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;

  const mm = Math.round(value * MM_PER_METER);
  if (!Number.isSafeInteger(mm)) return null;
  return mm;
}

/** Converts integer millimeters back to a decimal meter value. */
export function fromMillimeters(mm: number): number {
  return mm / MM_PER_METER;
}

/** Formats millimeters as a meter string for `<input>` defaults. */
export function formatMmForInput(mm: number): string {
  return String(fromMillimeters(mm));
}

/** Renders millimeters as a human string, e.g. "3,000 m". */
export function formatMeters(mm: number): string {
  const meters = fromMillimeters(mm);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(meters);
  return `${formatted} m`;
}
