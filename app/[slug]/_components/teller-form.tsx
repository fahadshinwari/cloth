"use client";

import { useActionState } from "react";
import type { FormActionState } from "@/app/actions/partner.actions";
import { Field, SelectInput, TextInput } from "../../_components/ui";
import { useI18n } from "../../_components/i18n-provider";

function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Manual teller cash entry — the merchant adds or removes cash by hand.
 * Every entry is an independent audited transaction; the balance is derived.
 */
export function TellerForm({
  action,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, {} as FormActionState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label={t("forms.common.type")} error={fieldErrors.type}>
        <SelectInput name="type" defaultValue="add">
          <option value="add">{t("forms.teller.addCash")}</option>
          <option value="remove">{t("forms.teller.removeCash")}</option>
        </SelectInput>
      </Field>

      <Field label={t("forms.common.amount")} error={fieldErrors.amount}>
        <TextInput
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          required
          dir="ltr"
          inputMode="decimal"
        />
      </Field>

      <Field label={t("forms.common.currency")} error={fieldErrors.currency}>
        <SelectInput name="currency" defaultValue="AFN">
          <option value="AFN">AFN</option>
          <option value="USD">USD</option>
        </SelectInput>
      </Field>

      <Field label={t("forms.common.date")} error={fieldErrors.occurredAt}>
        <TextInput name="occurredAt" type="date" defaultValue={todayISO()} dir="ltr" />
      </Field>

      <Field label={t("forms.common.note")} error={fieldErrors.note} hint={t("forms.teller.noteHint")}>
        <TextInput name="note" maxLength={2000} />
      </Field>

      {state.ok ? <p className="text-sm text-emerald-600 sm:col-span-2">{t("forms.common.recorded")}</p> : null}
      {state.error ? <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p> : null}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {pending ? "…" : t("forms.teller.record")}
        </button>
      </div>
    </form>
  );
}
