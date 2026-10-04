"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { Currency } from "@/lib/constants";
import { useI18n } from "../../_components/i18n-provider";

export interface LedgerFilterOption {
  /** Param value, e.g. `goods`, `payment`, `purchase`, `add`. */
  value: string;
  label: string;
}

/**
 * Reusable ledger filters: date range, currency, transaction type.
 * Writes to URL search params so views stay shareable and the same query
 * string can later feed CSV export endpoints.
 */
export function LedgerFilters({
  typeOptions,
}: {
  typeOptions: LedgerFilterOption[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "") params.delete(key);
    else params.set(key, value);
    startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
  };

  const inputClass =
    "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";

  const currencies: Currency[] = ["AFN", "USD"];

  return (
    <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-5 ${pending ? "opacity-60" : ""}`}>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t("forms.common.from")}</span>
        <input
          type="date"
          dir="ltr"
          className={inputClass}
          defaultValue={searchParams.get("from") ?? ""}
          onChange={(event) => update("from", event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t("forms.common.to")}</span>
        <input
          type="date"
          dir="ltr"
          className={inputClass}
          defaultValue={searchParams.get("to") ?? ""}
          onChange={(event) => update("to", event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t("forms.common.currency")}</span>
        <select
          className={inputClass}
          defaultValue={searchParams.get("currency") ?? ""}
          onChange={(event) => update("currency", event.target.value)}
        >
          <option value="">{t("forms.common.all")}</option>
          {currencies.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t("forms.common.type")}</span>
        <select
          className={inputClass}
          defaultValue={searchParams.get("type") ?? ""}
          onChange={(event) => update("type", event.target.value)}
        >
          <option value="">{t("forms.common.all")}</option>
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-end">
        <button
          type="button"
          onClick={() => startTransition(() => router.replace("?", { scroll: false }))}
          className="h-[38px] w-full rounded-md border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {t("forms.common.clearFilters")}
        </button>
      </div>
    </div>
  );
}
