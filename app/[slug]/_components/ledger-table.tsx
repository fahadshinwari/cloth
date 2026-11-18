import type { ReactNode } from "react";
import { formatDate, formatMinorAmount } from "@/lib/i18n/format";
import type { Locale } from "@/lib/constants";
import type { LedgerRow, LedgerView } from "@/lib/ledger";
import { LEDGER_SEMANTICS } from "@/lib/ledger";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { PrintButton } from "../../_components/print-button";

/**
 * Reusable ledger table used by buyers, suppliers, and the teller.
 * Columns: Date | Description | Debit | Credit | Balance | Currency
 *
 * Debit/credit meanings are labeled per ledger kind via LedgerSemantics:
 * - Buyer:   debit = goods given,   credit = payments received
 * - Supplier: debit = payments made, credit = clothing taken
 * - Teller:  debit = cash in,      credit = cash out
 */
export function LedgerTable({
  view,
  kind,
  locale,
  emptyMessage,
  printId,
  printTitle,
  actionsLabel,
  renderRowActions,
}: {
  view: LedgerView;
  kind: keyof typeof LEDGER_SEMANTICS;
  locale: Locale;
  emptyMessage: string;
  /** When set, the table is wrapped in a printable section with this id. */
  printId?: string;
  printTitle?: string;
  actionsLabel?: string;
  /** Optional per-row edit/delete controls (client components). */
  renderRowActions?: (row: LedgerRow) => ReactNode;
}) {
  const t = getTranslator(locale);
  const hasActions = Boolean(renderRowActions);
  const columnCount = hasActions ? 7 : 6;

  const openingRows = (["AFN", "USD"] as const)
    .filter((currency) => view.opening[currency] !== 0)
    .map((currency) => ({ currency, amount: view.opening[currency] }));

  const hasRows = view.rows.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Totals summary — per currency, never merged. */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            {t("ledger.openingBalance")}
          </div>
          <div className="mt-1 flex flex-col text-sm font-medium" dir="ltr">
            {openingRows.length === 0 ? (
              <span className="text-zinc-500">—</span>
            ) : (
              openingRows.map((row) => (
                <span key={row.currency}>{formatMinorAmount(row.amount, row.currency)}</span>
              ))
            )}
          </div>
        </div>
        <div className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            {t("ledger.total")} {t(`ledger.labels.${kind}.debit`)}
          </div>
          <div className="mt-1 flex flex-col text-sm font-medium" dir="ltr">
            <span>{formatMinorAmount(view.totalDebits.AFN, "AFN")}</span>
            <span>{formatMinorAmount(view.totalDebits.USD, "USD")}</span>
          </div>
        </div>
        <div className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            {t("ledger.total")} {t(`ledger.labels.${kind}.credit`)}
          </div>
          <div className="mt-1 flex flex-col text-sm font-medium" dir="ltr">
            <span>{formatMinorAmount(view.totalCredits.AFN, "AFN")}</span>
            <span>{formatMinorAmount(view.totalCredits.USD, "USD")}</span>
          </div>
        </div>
      </div>

      {printId ? (
        <div className="flex justify-end">
          <PrintButton targetId={printId} label={t("common.print")} />
        </div>
      ) : null}

      <div
        id={printId}
        data-print-root={printId ? "" : undefined}
        className="overflow-x-auto"
      >
        {printTitle ? (
          <h2 className="mb-3 hidden text-lg font-semibold print:block">{printTitle}</h2>
        ) : null}

        <table className="w-full min-w-[820px] text-start text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <th className="px-4 py-3 text-start font-medium">{t("ledger.date")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("ledger.description")}</th>
              <th className="px-4 py-3 text-start font-medium">{t(`ledger.labels.${kind}.debit`)}</th>
              <th className="px-4 py-3 text-start font-medium">{t(`ledger.labels.${kind}.credit`)}</th>
              <th className="px-4 py-3 text-start font-medium">{t("ledger.balance")}</th>
              <th className="px-4 py-3 text-start font-medium">{t("ledger.currency")}</th>
              {hasActions ? (
                <th className="px-4 py-3 text-start font-medium print:hidden">
                  {actionsLabel ?? t("common.actions")}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {!hasRows && openingRows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6 text-center text-zinc-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : null}

            {openingRows.length > 0 ? (
              <tr className="bg-zinc-50 dark:bg-zinc-800/40">
                <td className="px-4 py-2 text-xs text-zinc-500" colSpan={4}>
                  {t("ledger.openingBalanceNote")}
                </td>
                <td className="px-4 py-2 font-medium" dir="ltr">
                  {openingRows.map((row) => (
                    <span key={row.currency} className="mr-3">
                      {formatMinorAmount(row.amount, row.currency)}
                    </span>
                  ))}
                </td>
                <td className="px-4 py-2 text-xs text-zinc-500">AFN / USD</td>
                {hasActions ? <td className="print:hidden" /> : null}
              </tr>
            ) : null}

            {view.rows.map((row: LedgerRow) => (
              <tr
                key={row.id}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
              >
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.date, locale)}</td>
                <td className="px-4 py-3">
                  {row.description}
                  {row.billNo ? (
                    <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                      {t("ledger.bill")} {row.billNo}
                    </span>
                  ) : null}
                  {row.receivedBy ? (
                    <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-800">
                      {t("ledger.receivedBy")}: {row.receivedBy}
                    </span>
                  ) : null}
                  {row.source && row.source !== "manual" ? (
                    <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-800">
                      {t(`ledger.sources.${row.source}`)}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3" dir="ltr">
                  {row.debitMinor > 0 ? formatMinorAmount(row.debitMinor, row.currency) : "—"}
                </td>
                <td className="px-4 py-3" dir="ltr">
                  {row.creditMinor > 0 ? formatMinorAmount(row.creditMinor, row.currency) : "—"}
                </td>
                <td className="px-4 py-3 font-medium" dir="ltr">
                  {formatMinorAmount(row.balanceMinor, row.currency)}
                </td>
                <td className="px-4 py-3 text-zinc-500">{row.currency}</td>
                {hasActions ? (
                  <td className="px-4 py-3 print:hidden">{renderRowActions?.(row)}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
          {hasRows ? (
            <tfoot>
              <tr className="border-t-2 border-zinc-300 font-semibold dark:border-zinc-700">
                <td className="px-4 py-3" colSpan={2}>
                  {t("ledger.totalsInView")}
                </td>
                <td className="px-4 py-3" dir="ltr">
                  <span className="block">{formatMinorAmount(view.totalDebits.AFN, "AFN")}</span>
                  <span className="block">{formatMinorAmount(view.totalDebits.USD, "USD")}</span>
                </td>
                <td className="px-4 py-3" dir="ltr">
                  <span className="block">{formatMinorAmount(view.totalCredits.AFN, "AFN")}</span>
                  <span className="block">{formatMinorAmount(view.totalCredits.USD, "USD")}</span>
                </td>
                <td className="px-4 py-3" dir="ltr">
                  <span className="block">{formatMinorAmount(view.closing.AFN, "AFN")}</span>
                  <span className="block">{formatMinorAmount(view.closing.USD, "USD")}</span>
                </td>
                <td className="px-4 py-3 text-zinc-500">AFN / USD</td>
                {hasActions ? <td className="print:hidden" /> : null}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
