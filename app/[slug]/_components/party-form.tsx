"use client";

import { useActionState } from "react";
import type { FormActionState } from "@/app/actions/partner.actions";
import { Field, SelectInput, TextInput } from "../../_components/ui";
import { useI18n } from "../../_components/i18n-provider";

export interface SupplierFormValues {
  name?: string;
  companyName?: string;
  phone?: string;
  address?: string;
  notes?: string;
  status?: string;
}

export function SupplierForm({
  action,
  values,
  submitLabel,
  onCancelHref,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  values?: SupplierFormValues;
  submitLabel: string;
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

      <Field label={t("forms.common.companyName")} error={fieldErrors.companyName} hint={t("forms.common.optional")}>
        <TextInput name="companyName" defaultValue={values?.companyName} maxLength={120} />
      </Field>

      <Field label={t("forms.common.phone")} error={fieldErrors.phone} hint={t("forms.common.optional")}>
        <TextInput name="phone" defaultValue={values?.phone} dir="ltr" maxLength={40} />
      </Field>

      <Field label={t("forms.common.address")} error={fieldErrors.address} hint={t("forms.common.optional")}>
        <TextInput name="address" defaultValue={values?.address} maxLength={500} />
      </Field>

      <Field label={t("forms.common.status")} error={fieldErrors.status}>
        <SelectInput name="status" defaultValue={values?.status ?? "active"}>
          <option value="active">{t("forms.common.active")}</option>
          <option value="inactive">{t("forms.common.inactive")}</option>
        </SelectInput>
      </Field>

      <Field label={t("forms.common.notes")} error={fieldErrors.notes} hint={t("forms.common.optional")}>
        <textarea
          name="notes"
          defaultValue={values?.notes}
          rows={3}
          maxLength={2000}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </Field>

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
