"use client";

import { useActionState } from "react";
import type { FormActionState } from "@/app/actions/partner.actions";
import { Field, TextInput } from "../../_components/ui";
import { useI18n } from "../../_components/i18n-provider";

export function RoleForm({
  action,
  permissions,
  values,
  submitLabel,
  lockPermissions = false,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  /** All known permissions with translated labels. */
  permissions: Array<{ value: string; label: string }>;
  values?: { name?: string; permissions?: string[]; key?: string };
  submitLabel: string;
  lockPermissions?: boolean;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, {} as FormActionState);
  const fieldErrors = state.fieldErrors ?? {};
  const selected = new Set(values?.permissions ?? []);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("roles.fields.name")} error={fieldErrors.name} hint={values?.key ? `key: ${values.key}` : undefined}>
          <TextInput name="name" defaultValue={values?.name} required maxLength={120} />
        </Field>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
          {t("roles.fields.permissions")}
        </legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {permissions.map((permission) => (
            <label key={permission.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="permissions"
                value={permission.value}
                defaultChecked={selected.has(permission.value)}
                disabled={lockPermissions}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span>{permission.label}</span>
            </label>
          ))}
        </div>
        {lockPermissions ? (
          <p className="text-xs text-zinc-500">{t("roles.ownerLocked")}</p>
        ) : null}
      </fieldset>

      {state.ok ? <p className="text-sm text-emerald-600">{t("forms.common.saved")}</p> : null}
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

      <div>
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
