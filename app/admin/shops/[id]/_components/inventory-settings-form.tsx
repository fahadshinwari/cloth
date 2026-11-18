"use client";

import { useTransition } from "react";
import {
  toggleAdvancePaymentsAction,
  toggleNegativeInventoryAction,
} from "@/app/actions/tenant.actions";
import { useI18n } from "../../../../_components/i18n-provider";

export function InventorySettingsForm({
  shopId,
  allowNegativeInventory,
  allowAdvancePayments,
}: {
  shopId: string;
  allowNegativeInventory: boolean;
  allowAdvancePayments: boolean;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  const buttonClass =
    "inline-flex h-10 shrink-0 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{t("admin.settings.allowNegativeInventory")}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {t("admin.settings.allowNegativeInventoryHint")}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => void toggleNegativeInventoryAction(shopId, !allowNegativeInventory))
          }
          className={buttonClass}
          dir="ltr"
        >
          {pending
            ? "…"
            : allowNegativeInventory
              ? t("admin.settings.allowed")
              : t("admin.settings.notAllowed")}
        </button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{t("admin.settings.allowAdvancePayments")}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {t("admin.settings.allowAdvancePaymentsHint")}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => void toggleAdvancePaymentsAction(shopId, !allowAdvancePayments))
          }
          className={buttonClass}
          dir="ltr"
        >
          {pending
            ? "…"
            : allowAdvancePayments
              ? t("admin.settings.allowed")
              : t("admin.settings.notAllowed")}
        </button>
      </div>
    </div>
  );
}
