"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRoleAction } from "@/app/actions/user.actions";
import { useI18n } from "../../_components/i18n-provider";

export function RoleDeleteButton({ roleId }: { roleId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(t("roles.deleteConfirm"))) return;
          setError("");
          startTransition(async () => {
            const result = await deleteRoleAction(roleId);
            if (result.error) setError(result.error);
            else router.refresh();
          });
        }}
        className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
      >
        {pending ? "…" : t("common.delete")}
      </button>
      {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
    </div>
  );
}
