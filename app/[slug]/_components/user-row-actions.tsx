"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteShopUserAction,
  setShopUserActiveAction,
} from "@/app/actions/user.actions";
import { useI18n } from "../../_components/i18n-provider";

export function UserRowActions({
  userId,
  active,
  isSelf,
}: {
  userId: string;
  active: boolean;
  isSelf: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const run = (operation: () => Promise<{ error?: string }>) => {
    setError("");
    startTransition(async () => {
      const result = await operation();
      if (result.error) setError(result.error);
      else router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={pending || (isSelf && active)}
        onClick={() => run(() => setShopUserActiveAction(userId, !active))}
        className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {active ? t("users.deactivate") : t("users.activate")}
      </button>
      <button
        type="button"
        disabled={pending || isSelf}
        onClick={() => {
          if (!window.confirm(t("users.deleteConfirm"))) return;
          run(() => deleteShopUserAction(userId));
        }}
        className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
      >
        {t("common.delete")}
      </button>
      {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
    </div>
  );
}
