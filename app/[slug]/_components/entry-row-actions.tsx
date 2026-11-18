"use client";

import { useTransition } from "react";
import { deleteLedgerEntryAction } from "@/app/actions/buyer.actions";
import { deleteInvestmentAction } from "@/app/actions/partner.actions";
import { useI18n } from "../../_components/i18n-provider";

/**
 * Delete button shared by ledger entries (Module 2) and investment
 * records (Module 1). Ledger entries always require a reason.
 */
export function EntryRowActions({ kind, entryId }: { kind: "investment" | "ledger"; entryId: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (kind === "ledger") {
          const reason = window.prompt(t("ledger.deleteReasonPrompt"));
          if (reason === null) return;
          if (reason.trim().length < 3) {
            window.alert(t("ledger.reasonRequired"));
            return;
          }
          startTransition(() => void deleteLedgerEntryAction(entryId, reason));
          return;
        }

        if (!window.confirm(t("common.delete"))) return;
        startTransition(() => void deleteInvestmentAction(entryId));
      }}
      className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
      dir="ltr"
    >
      {pending ? "…" : t("common.delete")}
    </button>
  );
}
