"use client";

import { useActionState } from "react";
import type { ShopFormState } from "@/app/actions/tenant.actions";

export interface ShopFormValues {
  name?: string;
  slug?: string;
  adminName?: string;
  adminEmail?: string;
  phone?: string;
  currency?: string;
  status?: string;
}

export function ShopForm({
  action,
  values,
  submitLabel,
  editing = false,
}: {
  action: (state: ShopFormState, formData: FormData) => Promise<ShopFormState>;
  values?: ShopFormValues;
  submitLabel: string;
  editing?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ShopFormState);
  const fieldErrors = state.fieldErrors ?? {};

  const inputClass =
    "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
        <span className="font-medium">Shop name</span>
        <input name="name" defaultValue={values?.name} required className={inputClass} />
        {fieldErrors.name ? <span className="text-xs text-red-600">{fieldErrors.name}</span> : null}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Slug</span>
        <input
          name="slug"
          defaultValue={values?.slug}
          required
          dir="ltr"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          className={inputClass}
        />
        <span className="text-xs text-zinc-500">URL: /{values?.slug || "shop"}/dashboard</span>
        {fieldErrors.slug ? <span className="text-xs text-red-600">{fieldErrors.slug}</span> : null}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Phone</span>
        <input name="phone" defaultValue={values?.phone} required dir="ltr" className={inputClass} />
        {fieldErrors.phone ? <span className="text-xs text-red-600">{fieldErrors.phone}</span> : null}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Admin name</span>
        <input name="adminName" defaultValue={values?.adminName} required className={inputClass} />
        {fieldErrors.adminName ? <span className="text-xs text-red-600">{fieldErrors.adminName}</span> : null}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Admin email</span>
        <input
          name="adminEmail"
          type="email"
          defaultValue={values?.adminEmail}
          required
          dir="ltr"
          className={inputClass}
        />
        {fieldErrors.adminEmail ? <span className="text-xs text-red-600">{fieldErrors.adminEmail}</span> : null}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Admin password {editing ? "(optional)" : ""}</span>
        <input
          name="adminPassword"
          type="password"
          minLength={editing ? 0 : 8}
          autoComplete="new-password"
          dir="ltr"
          className={inputClass}
        />
        <span className="text-xs text-zinc-500">
          {editing ? "Leave blank to keep the current password." : "At least 8 characters."}
        </span>
        {fieldErrors.adminPassword ? (
          <span className="text-xs text-red-600">{fieldErrors.adminPassword}</span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Currency</span>
        <select name="currency" defaultValue={values?.currency ?? "AFN"} className={inputClass}>
          <option value="AFN">AFN</option>
          <option value="USD">USD</option>
        </select>
        {fieldErrors.currency ? <span className="text-xs text-red-600">{fieldErrors.currency}</span> : null}
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Status</span>
        <select name="status" defaultValue={values?.status ?? "active"} className={inputClass}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {fieldErrors.status ? <span className="text-xs text-red-600">{fieldErrors.status}</span> : null}
      </label>

      {state.error ? (
        <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p>
      ) : null}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {pending ? "…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
