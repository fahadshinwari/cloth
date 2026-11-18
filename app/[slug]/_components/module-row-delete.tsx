"use client";

import { useTransition } from "react";
import { deleteExpenseAction } from "@/app/actions/expense.actions";
import { deleteEmployeeAction } from "@/app/actions/employee.actions";
import { useI18n } from "../../_components/i18n-provider";

/** Delete button shared by expense and employee rows. */
export function ModuleRowDelete({
  kind,
  entryId,
}: {
  kind: "expense" | "employee";
  entryId: string;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const action = kind === "expense" ? deleteExpenseAction : deleteEmployeeAction;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(t("common.delete"))) return;
        startTransition(() => void action(entryId));
      }}
      className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
    >
      {pending ? "…" : t("common.delete")}
    </button>
  );
}
