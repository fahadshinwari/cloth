"use client";

import { useActionState, useState } from "react";
import type { FormActionState } from "@/app/actions/partner.actions";
import { Field, SelectInput, TextInput } from "../../_components/ui";
import { useI18n } from "../../_components/i18n-provider";
import { ReceiptCard } from "./receipt-card";

function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Form for recording a money entry with an explicit currency selector so
 * AFN and USD are always distinct records — never combined or converted.
 * Used for both partner investments and buyer/supplier ledger entries.
 *
 * Bill number is always available. "Received by" is shown only for payment
 * entries — the expense/employee names are never offered for goods given.
 */
export function TransactionForm({
  action,
  hiddenIdField,
  hiddenIdValue,
  amountLabel,
  typeSelector,
  receivedByOptions,
  submitLabel,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  /** Field name for the owning entity, e.g. `partnerId` or `buyerId`. */
  hiddenIdField: string;
  hiddenIdValue: string;
  amountLabel: string;
  /** Optional leading select, e.g. goods vs payment. */
  typeSelector?: { name: string; options: Array<{ value: string; label: string }> };
  /** Expense category / employee names offered when the entry is a payment. */
  receivedByOptions?: string[];
  submitLabel: string;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, {} as FormActionState);
  const fieldErrors = state.fieldErrors ?? {};
  const [type, setType] = useState(typeSelector?.options[0]?.value ?? "");
  const showReceivedBy = Boolean(typeSelector) && type === "payment";

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name={hiddenIdField} value={hiddenIdValue} />

      {typeSelector ? (
        <Field label={t("forms.common.type")} error={fieldErrors.type}>
          <SelectInput
            name={typeSelector.name}
            defaultValue={typeSelector.options[0]?.value}
            onChange={(event) => setType(event.target.value)}
          >
            {typeSelector.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectInput>
        </Field>
      ) : null}

      <Field label={amountLabel} error={fieldErrors.amount}>
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

      <Field label={t("forms.common.currency")} error={fieldErrors.currency} hint={t("forms.common.currencySeparateHint")}>
        <SelectInput name="currency" defaultValue="AFN">
          <option value="AFN">AFN</option>
          <option value="USD">USD</option>
        </SelectInput>
      </Field>

      <Field label={t("forms.common.billNo")} error={fieldErrors.billNo} hint={t("forms.common.billNoHint")}>
        <TextInput name="billNo" maxLength={40} dir="ltr" placeholder="202" />
      </Field>

      {showReceivedBy ? (
        <Field label={t("forms.common.receivedBy")} error={fieldErrors.receivedBy} hint={t("forms.common.receivedByHint")}>
          <SelectInput name="receivedBy" defaultValue="">
            <option value="">{t("forms.common.none")}</option>
            {(receivedByOptions ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </SelectInput>
        </Field>
      ) : null}

      <Field label={t("forms.common.date")} error={fieldErrors.investedAt ?? fieldErrors.occurredAt}>
        <TextInput name={typeSelector ? "occurredAt" : "investedAt"} type="date" defaultValue={todayISO()} dir="ltr" />
      </Field>

      <Field label={t("forms.common.note")} error={fieldErrors.note} hint={t("forms.common.optional")}>
        <TextInput name="note" maxLength={2000} />
      </Field>

      {state.ok ? <p className="text-sm text-emerald-600 sm:col-span-2">{t("forms.common.recorded")}</p> : null}
      {state.error ? <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p> : null}

      {state.print ? (
        <div className="sm:col-span-2">
          <ReceiptCard print={state.print} />
        </div>
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
