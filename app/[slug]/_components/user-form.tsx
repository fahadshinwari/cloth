"use client";

import { useActionState } from "react";
import type { FormActionState } from "@/app/actions/partner.actions";
import { Field, SelectInput, TextInput } from "../../_components/ui";
import { useI18n } from "../../_components/i18n-provider";

export interface UserFormValues {
  name?: string;
  email?: string;
  roleKey?: string;
  isActive?: boolean;
}

export function UserForm({
  action,
  roles,
  values,
  submitLabel,
  requirePassword,
  onCancelHref,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  roles: Array<{ key: string; name: string }>;
  values?: UserFormValues;
  submitLabel: string;
  requirePassword: boolean;
  onCancelHref?: string;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, {} as FormActionState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label={t("forms.common.name")} error={fieldErrors.name}>
        <TextInput name="name" defaultValue={values?.name} required maxLength={120} />
      </Field>

      <Field label={t("forms.common.email")} error={fieldErrors.email}>
        <TextInput
          name="email"
          type="email"
          defaultValue={values?.email}
          required
          dir="ltr"
          maxLength={254}
        />
      </Field>

      <Field label={t("users.fields.role")} error={fieldErrors.roleKey}>
        <SelectInput name="roleKey" defaultValue={values?.roleKey ?? roles[0]?.key}>
          {roles.map((role) => (
            <option key={role.key} value={role.key}>
              {role.name}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field
        label={t("users.fields.password")}
        error={fieldErrors.password}
        hint={requirePassword ? t("admin.fields.passwordMin") : t("users.fields.passwordHint")}
      >
        <TextInput
          name="password"
          type="password"
          required={requirePassword}
          minLength={8}
          dir="ltr"
          autoComplete="new-password"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={values?.isActive ?? true}
          className="h-4 w-4 rounded border-zinc-300"
        />
        <span>{t("users.fields.active")}</span>
      </label>

      {state.ok ? <p className="text-sm text-emerald-600 sm:col-span-2">{t("forms.common.saved")}</p> : null}
      {state.error ? <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p> : null}

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {pending ? "…" : submitLabel}
        </button>
        {onCancelHref ? (
          <a href={onCancelHref} className="text-sm text-zinc-500 hover:underline">
            {t("forms.common.cancel")}
          </a>
        ) : null}
      </div>
    </form>
  );
}
