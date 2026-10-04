"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth.actions";

export function LogoutButton({ className }: { className?: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={
        className ??
        "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      }
      onClick={() => startTransition(() => void logoutAction())}
    >
      {pending ? "…" : "Log out"}
    </button>
  );
}
