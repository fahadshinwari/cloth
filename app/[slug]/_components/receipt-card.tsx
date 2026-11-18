"use client";

import { useId } from "react";
import type { PrintPayload } from "@/lib/print";
import { formatDate, formatMinorAmount } from "@/lib/i18n/format";
import { PrintButton } from "../../_components/print-button";
import { useI18n } from "../../_components/i18n-provider";

/** Receipt for a just-saved ledger entry, with a print button. */
export function ReceiptCard({ print }: { print: PrintPayload }) {
  const { t, locale } = useI18n();
  const reactId = useId();
  const targetId = `receipt-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const typeLabel =
    print.type === "goods"
      ? t("buyers.entryGoods")
      : print.type === "purchase"
        ? t("suppliers.entryPurchase")
        : t("bills.types.payment");

  const rows: Array<[string, string]> = [
    [t("print.party"), print.partyName],
    ...(print.partyCode ? [[t("print.code"), print.partyCode] as [string, string]] : []),
    [t("print.type"), typeLabel],
    [t("print.amount"), formatMinorAmount(print.amountMinor, print.currency)],
    [t("print.date"), formatDate(print.date, locale)],
    ...(print.billNo ? [[t("print.billNo"), print.billNo] as [string, string]] : []),
    ...(print.receivedBy ? [[t("print.receivedBy"), print.receivedBy] as [string, string]] : []),
    ...(print.note ? [[t("print.note"), print.note] as [string, string]] : []),
  ];

  return (
    <div
      id={targetId}
      data-print-root=""
      className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50/40 p-4 dark:border-emerald-900 dark:bg-emerald-950/20"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          {t("print.savedReceipt")}
        </p>
        <PrintButton targetId={targetId} label={t("common.print")} />
      </div>

      <div className="mx-auto max-w-md text-sm">
        <div className="text-center">
          <h3 className="text-lg font-semibold">{print.shopName || t("common.appName")}</h3>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            {print.kind === "buyer" ? t("print.buyerEntry") : t("print.supplierEntry")}
          </p>
        </div>

        <dl className="mt-4 flex flex-col gap-1.5">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-dashed border-zinc-300 py-1 last:border-0 dark:border-zinc-700">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="text-end font-medium" dir="auto">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
