import type { Currency } from "./constants";
import { isCurrency } from "./money";
import { parseDateParam, type LedgerFilters } from "./ledger";

/** Shape of Next.js searchParams in pages. */
type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Reads ledger filters from page search params:
 * ?from=2026-01-01&to=2026-02-01&currency=USD&type=payment
 */
export function ledgerFiltersFromSearchParams(searchParams: SearchParams): LedgerFilters {
  const currencyRaw = first(searchParams.currency);
  const currency: Currency | undefined = isCurrency(currencyRaw) ? currencyRaw : undefined;

  return {
    from: parseDateParam(first(searchParams.from)),
    to: parseDateParam(first(searchParams.to)),
    currency,
    type: first(searchParams.type) || undefined,
  };
}
