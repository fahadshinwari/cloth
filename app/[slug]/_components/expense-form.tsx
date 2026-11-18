"use client";

import { useActionState, useState } from "react";
import type { FormActionState } from "@/app/actions/partner.actions";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { Field, SelectInput, TextInput } from "../../_components/ui";
import { useI18n } from "../../_components/i18n-provider";

export interface ExpenseFormValues {
  category?: string;
  name?: string;
  employeeId?: string;
  amount?: string;
  currency?: string;
  occurredAt?: string;
  note?: string;
}

function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function ExpenseForm({
  action,
  values,
  employees = [],
  submitLabel,
  onCancelHref,
}: {
  action: (state: FormActionState, formData: FormData) => Promise<FormActionState>;
  values?: ExpenseFormValues;
  employees?: Array<{ id: string; name: string; salaryAmount: string; salaryCurrency: string }>;
  submitLabel: string;
  onCancelHref?: string;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(action, {} as FormActionState);
  const fieldErrors = state.fieldErrors ?? {};
  const [category, setCategory] = useState(values?.category ?? "shopRent");
  const [employeeId, setEmployeeId] = useState(values?.employeeId ?? "");
  const [amount, setAmount] = useState(values?.amount ?? "");
  const [currency, setCurrency] = useState(values?.currency ?? "AFN");

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label={t("expenses.fields.category")} error={fieldErrors.category}>
        <SelectInput
          name="category"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            if (event.target.value !== "salary") setEmployeeId("");
          }}
        >
          {EXPENSE_CATEGORIES.map((key) => (
            <option key={key} value={key}>
              {t(`expenses.categories.${key}`)}
            </option>
          ))}
        </SelectInput>
      </Field>

      {category === "salary" ? (
        <Field
          label={t("expenses.fields.employee")}
          error={fieldErrors.employeeId}
          hint={t("expenses.fields.salaryHint")}
        >
          <SelectInput
            name="employeeId"
            value={employeeId}
            onChange={(event) => {
              const id = event.target.value;
              setEmployeeId(id);
              const employee = employees.find((item) => item.id === id);
              if (employee) {
                if (employee.salaryAmount) setAmount(employee.salaryAmount);
                setCurrency(employee.salaryCurrency);
              }
            }}
          >
            <option value="">{t("expenses.fields.selectEmployee")}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      ) : null}

      <Field label={t("expenses.fields.name")} error={fieldErrors.name} hint={t("expenses.fields.nameHint")}>
        <TextInput name="name" defaultValue={values?.name} maxLength={120} />
      </Field>

      <Field label={t("forms.common.amount")} error={fieldErrors.amount}>
        <TextInput
          name="amount"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
          dir="ltr"
          inputMode="decimal"
        />
      </Field>

      <Field label={t("forms.common.currency")} error={fieldErrors.currency}>
        <SelectInput
          name="currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
        >
          <option value="AFN">AFN</option>
          <option value="USD">USD</option>
        </SelectInput>
      </Field>

      <Field label={t("forms.common.date")} error={fieldErrors.occurredAt}>
        <TextInput name="occurredAt" type="date" defaultValue={values?.occurredAt ?? todayISO()} dir="ltr" />
      </Field>

      <Field label={t("forms.common.note")} error={fieldErrors.note} hint={t("forms.common.optional")}>
        <TextInput name="note" defaultValue={values?.note} maxLength={2000} />
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
