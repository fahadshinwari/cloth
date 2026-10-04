"use client";

import { useTransition } from "react";
import { deleteReminderAction, toggleReminderAction } from "@/app/actions/buyer.actions";
import { useI18n } from "../../_components/i18n-provider";

export function ReminderRowActions({
  reminderId,
  active,
}: {
  reminderId: string;
  active: boolean;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2" dir="ltr">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void toggleReminderAction(reminderId, !active))}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {active ? t("admin.actions.deactivate") : t("admin.actions.activate")}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void deleteReminderAction(reminderId))}
        className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
      >
        {t("common.delete")}
      </button>
    </div>
  );
}
