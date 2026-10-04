"use client";

import { useTransition } from "react";
import { deleteLedgerEntryAction } from "@/app/actions/buyer.actions";
import { deleteInvestmentAction } from "@/app/actions/partner.actions";
import { useI18n } from "../../_components/i18n-provider";

/**
 * Delete button shared by ledger entries (Module 2) and investment
 * records (Module 1). Deleting history is allowed but explicit.
 */
export function EntryRowActions({ kind, entryId }: { kind: "investment" | "ledger"; entryId: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  const action = kind === "investment" ? deleteInvestmentAction : deleteLedgerEntryAction;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t("common.delete"))) return;
        startTransition(() => void action(entryId));
      }}
      className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
      dir="ltr"
    >
      {pending ? "…" : t("common.delete")}
    </button>
  );
}
