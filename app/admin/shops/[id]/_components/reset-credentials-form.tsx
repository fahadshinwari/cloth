"use client";

import { useActionState } from "react";
import type { ResetCredentialsState } from "@/app/actions/tenant.actions";

export function ResetCredentialsForm({
  action,
}: {
  action: (state: ResetCredentialsState, formData: FormData) => Promise<ResetCredentialsState>;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ResetCredentialsState);
  const fieldErrors = state.fieldErrors ?? {};

  const inputClass =
    "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">New email (optional)</span>
        <input name="adminEmail" type="email" dir="ltr" className={inputClass} />
        {fieldErrors.adminEmail ? (
          <span className="text-xs text-red-600">{fieldErrors.adminEmail}</span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">New password (optional)</span>
        <input name="adminPassword" type="password" autoComplete="new-password" dir="ltr" className={inputClass} />
        {fieldErrors.adminPassword ? (
          <span className="text-xs text-red-600">{fieldErrors.adminPassword}</span>
        ) : null}
      </label>

      {state.ok ? <p className="text-sm text-emerald-600 sm:col-span-2">Credentials updated.</p> : null}
      {state.error ? <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p> : null}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {pending ? "…" : "Update credentials"}
        </button>
      </div>
    </form>
  );
}
