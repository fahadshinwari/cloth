"use client";

import { useActionState } from "react";
import type { FormActionState } from "@/app/actions/partner.actions";
import { Field, SelectInput, TextInput } from "../../_components/ui";
import { useI18n } from "../../_components/i18n-provider";

export interface ClothFormValues {
  name?: string;
  category?: string;
  description?: string;
  pricePerMeter?: string;
  currency?: string;
  supplierId?: string;
  lowStockThresholdMeters?: string;
  notes?: string;
}

export function ClothForm({
  action,
  values,
  suppliers = [],
  submitLabel,
  onCancelHref,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  values?: ClothFormValues;
  suppliers?: Array<{ id: string; name: string; companyName?: string }>;
  submitLabel: string;
  onCancelHref?: string;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, {} as FormActionState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label={t("forms.cloth.clothName")} error={fieldErrors.name}>
        <TextInput name="name" defaultValue={values?.name} required maxLength={120} />
      </Field>

      <Field label={t("forms.cloth.category")} error={fieldErrors.category} hint={t("forms.cloth.categoryHint")}>
        <TextInput name="category" defaultValue={values?.category} maxLength={120} />
      </Field>

      <Field label={t("forms.cloth.pricePerMeter")} error={fieldErrors.pricePerMeter}>
        <TextInput
          name="pricePerMeter"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={values?.pricePerMeter}
          required
          dir="ltr"
          inputMode="decimal"
        />
      </Field>

      <Field label={t("forms.common.currency")} error={fieldErrors.currency} hint={t("forms.common.currencyHint")}>
        <SelectInput name="currency" defaultValue={values?.currency ?? "AFN"}>
          <option value="AFN">AFN</option>
          <option value="USD">USD</option>
        </SelectInput>
      </Field>

      <Field label={t("forms.common.supplier")} error={fieldErrors.supplierId} hint={t("forms.common.optional")}>
        <SelectInput name="supplierId" defaultValue={values?.supplierId ?? ""}>
          <option value="">{t("forms.common.none")}</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.companyName ? `${supplier.name} — ${supplier.companyName}` : supplier.name}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label={t("forms.cloth.description")} error={fieldErrors.description} hint={t("forms.common.optional")}>
        <TextInput name="description" defaultValue={values?.description} maxLength={2000} />
      </Field>

      <Field
        label={t("forms.cloth.lowStock")}
        error={fieldErrors.lowStockThresholdMeters}
        hint={t("forms.cloth.lowStockHint")}
      >
        <TextInput
          name="lowStockThresholdMeters"
          type="number"
          step="0.001"
          min="0"
          defaultValue={values?.lowStockThresholdMeters}
          dir="ltr"
          inputMode="decimal"
        />
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
