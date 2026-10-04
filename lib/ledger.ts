import type { Currency } from "./constants";

/**
 * Shared ledger engine (pure functions — no DB access).
 *
 * DEBIT/CREDIT SEMANTICS — explicitly defined per ledger kind:
 *
 * BUYER (receivable — money in the market):
 *   Debit  = clothes/goods given to the buyer  → they owe MORE
 *   Credit = payment received from the buyer   → they owe LESS
 *   Balance = Σ debits − Σ credits = outstanding receivable
 *
 * SUPPLIER (payable — money owed to suppliers):
 *   Debit  = payment made to the supplier      → you owe LESS
 *   Credit = clothes taken on credit           → you owe MORE
 *   Balance = Σ credits − Σ debits = outstanding payable
 *
 * TELLER (cash on hand):
 *   Debit  = cash added                        → cash increases
 *   Credit = cash removed                      → cash decreases
 *   Balance = Σ debits − Σ credits = cash with the teller
 *
 * Balances are ALWAYS derived from the entries below — never stored.
 * Payments of any size are simply new credit/debit rows, so unlimited
 * partial payments work with no special handling.
 */

export const LEDGER_KINDS = ["buyer", "supplier", "teller"] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export interface LedgerSemantics {
  kind: LedgerKind;
  /** true → balance = debits − credits (buyer, teller); false → credits − debits (supplier). */
  debitPositive: boolean;
  /** Label for the debit column in this ledger's business meaning. */
  debitLabel: string;
  /** Label for the credit column in this ledger's business meaning. */
  creditLabel: string;
}

export const LEDGER_SEMANTICS: Record<LedgerKind, LedgerSemantics> = {
  buyer: {
    kind: "buyer",
    debitPositive: true,
    debitLabel: "Debit (goods given)",
    creditLabel: "Credit (payments received)",
  },
  supplier: {
    kind: "supplier",
    debitPositive: false,
    debitLabel: "Debit (payments made)",
    creditLabel: "Credit (clothing taken)",
  },
  teller: {
    kind: "teller",
    debitPositive: true,
    debitLabel: "Debit (cash in)",
    creditLabel: "Credit (cash out)",
  },
};

/** A raw ledger entry mapped from any module (buyer, supplier, teller). */
export interface RawLedgerEntry {
  id: string;
  date: Date;
  description: string;
  /** Amount on the debit side, in integer minor units (0 if none). */
  debitMinor: number;
  /** Amount on the credit side, in integer minor units (0 if none). */
  creditMinor: number;
  currency: Currency;
  /** Transaction type for filtering: goods|payment|purchase|add|remove… */
  type: string;
  /** Optional provenance tag, e.g. sale, purchase, manual. */
  source?: string;
}

export interface LedgerFilters {
  /** Inclusive start of the visible window (start of day). */
  from?: Date;
  /** Inclusive end of the visible window (end of day). */
  to?: Date;
  currency?: Currency;
  type?: string;
}

export interface LedgerRow {
  id: string;
  date: Date;
  description: string;
  debitMinor: number;
  creditMinor: number;
  /** Running balance AFTER this row, in integer minor units. */
  balanceMinor: number;
  currency: Currency;
  source?: string;
}

export interface LedgerView {
  rows: LedgerRow[];
  /** Balance accumulated BEFORE the filtered window (per currency). */
  opening: Record<"AFN" | "USD", number>;
  /** Balance at the end of the filtered window (per currency). */
  closing: Record<"AFN" | "USD", number>;
  totalDebits: Record<"AFN" | "USD", number>;
  totalCredits: Record<"AFN" | "USD", number>;
  /** Filters actually applied (dates normalized) for display. */
  filters: LedgerFilters;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/**
 * Builds a full ledger view from raw entries:
 * 1. normalizes filters,
 * 2. computes the opening balance from everything BEFORE the window,
 * 3. sorts the window chronologically,
 * 4. walks rows in order applying the running balance per currency.
 */
export function buildLedgerView(
  entries: RawLedgerEntry[],
  semantics: LedgerSemantics,
  filters: LedgerFilters = {},
): LedgerView {
  const from = filters.from ? startOfDay(filters.from) : undefined;
  const to = filters.to ? endOfDay(filters.to) : undefined;

  const inWindow = (entry: RawLedgerEntry): boolean => {
    if (from && entry.date < from) return false;
    if (to && entry.date > to) return false;
    if (filters.currency && entry.currency !== filters.currency) return false;
    if (filters.type && entry.type !== filters.type) return false;
    return true;
  };

  // Opening balance: everything before the window, same currency/type filters.
  const opening: Record<"AFN" | "USD", number> = { AFN: 0, USD: 0 };
  for (const entry of entries) {
    const beforeWindow = from && entry.date < from;
    if (!beforeWindow) continue;
    if (filters.currency && entry.currency !== filters.currency) continue;
    if (filters.type && entry.type !== filters.type) continue;
    const delta = entry.debitMinor - entry.creditMinor;
    opening[entry.currency] += semantics.debitPositive ? delta : -delta;
  }

  const totalDebits: Record<"AFN" | "USD", number> = { AFN: 0, USD: 0 };
  const totalCredits: Record<"AFN" | "USD", number> = { AFN: 0, USD: 0 };
  const closing: Record<"AFN" | "USD", number> = { ...opening };

  const sorted = [...entries]
    .filter(inWindow)
    .sort(
      (a, b) =>
        a.date.getTime() - b.date.getTime() ||
        a.id.localeCompare(b.id),
    );

  const rows: LedgerRow[] = sorted.map((entry) => {
    totalDebits[entry.currency] += entry.debitMinor;
    totalCredits[entry.currency] += entry.creditMinor;
    const delta = entry.debitMinor - entry.creditMinor;
    closing[entry.currency] += semantics.debitPositive ? delta : -delta;
    return {
      id: entry.id,
      date: entry.date,
      description: entry.description,
      debitMinor: entry.debitMinor,
      creditMinor: entry.creditMinor,
      balanceMinor: closing[entry.currency],
      currency: entry.currency,
      source: entry.source,
    };
  });

  return {
    rows,
    opening,
    closing,
    totalDebits,
    totalCredits,
    filters: { from, to, currency: filters.currency, type: filters.type },
  };
}

/** Parses a yyyy-mm-dd (or full ISO) search param into a Date, or undefined. */
export function parseDateParam(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  const parsed = new Date(trimmed.length === 10 ? `${trimmed}T00:00:00` : trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
