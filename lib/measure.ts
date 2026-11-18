import { CLOTH_UNIT, type ClothUnit } from "./constants";

/**
 * Cloth measure helpers (Module 4).
 *
 * Cloth quantities are stored as integer MILLIMETERS of cloth so that
 * fractional units add up exactly without float drift — the same
 * integer-minor-unit approach used for money in lib/money.ts.
 *
 * Yards are the default buying/selling unit (1 yd = 914.4 mm); meters are
 * also supported. Storage stays canonical in millimeters.
 */

export const MM_PER_METER = 1000;
export const MM_PER_YARD = 914.4;
export const YARD_IN_METERS = MM_PER_YARD / MM_PER_METER;

/** Converts a canonical per-meter price (minor units) to a per-yard price. */
export function pricePerYardMinor(pricePerMeterMinor: number): number {
  return Math.round(pricePerMeterMinor * YARD_IN_METERS);
}

/** Millimeters in one of the given unit. */
export function mmPerUnit(unit: ClothUnit): number {
  return unit === CLOTH_UNIT.YARD ? MM_PER_YARD : MM_PER_METER;
}

/** Converts a user-entered value in `unit` to integer millimeters. */
export function toMillimetersForUnit(value: string | number, unit: ClothUnit): number | null {
  const trimmed = String(value).trim().replace(/,/g, "");
  if (trimmed === "") return null;
  if (!/^-?\d+(\.\d{1,3})?$/.test(trimmed)) return null;

  const number = Number(trimmed);
  if (!Number.isFinite(number)) return null;

  const mm = Math.round(number * mmPerUnit(unit));
  if (!Number.isSafeInteger(mm)) return null;
  return mm;
}

/** Converts integer millimeters back to a decimal value in `unit`. */
export function fromMillimetersForUnit(mm: number, unit: ClothUnit): number {
  return mm / mmPerUnit(unit);
}

/** Short label for a unit, e.g. "yd" / "m". */
export function unitShortLabel(unit: ClothUnit): string {
  return unit === CLOTH_UNIT.YARD ? "yd" : "m";
}

/**
 * Renders millimeters as a quantity in the given unit, e.g. "12.5 yd".
 * `label` lets callers pass the localized unit name (e.g. Dari/Pashto ګز).
 */
export function formatQuantity(mm: number, unit: ClothUnit, label?: string): string {
  const value = fromMillimetersForUnit(mm, unit);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
  return `${formatted} ${label ?? unitShortLabel(unit)}`;
}

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
