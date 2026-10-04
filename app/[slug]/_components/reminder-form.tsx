"use client";

import { useActionState } from "react";
import { createReminderAction } from "@/app/actions/buyer.actions";
import type { FormActionState } from "@/app/actions/partner.actions";
import { Field, SelectInput, TextInput } from "../../_components/ui";
import { useI18n } from "../../_components/i18n-provider";

/** Weekday option values match lib/constants REMINDER weekday numbering. */
const WEEKDAY_KEYS = [
  { value: "1", key: "reminders.weekdays.monday" },
  { value: "2", key: "reminders.weekdays.tuesday" },
  { value: "3", key: "reminders.weekdays.wednesday" },
  { value: "4", key: "reminders.weekdays.thursday" },
  { value: "5", key: "reminders.weekdays.friday" },
  { value: "6", key: "reminders.weekdays.saturday" },
  { value: "0", key: "reminders.weekdays.sunday" },
];

/**
 * Reminder form — informational only. Creating a reminder never touches
 * the buyer's ledger or balances.
 */
export function ReminderForm({
  buyerId,
  buyerIdFixed = false,
  buyers = [],
}: {
  buyerId?: string;
  buyerIdFixed?: boolean;
  buyers?: Array<{ id: string; name: string; shopName?: string }>;
}) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(createReminderAction, {} as FormActionState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {buyerIdFixed ? (
        <input type="hidden" name="buyerId" value={buyerId} />
      ) : (
        <Field label={t("forms.common.buyer")} error={fieldErrors.buyerId}>
          <SelectInput name="buyerId" defaultValue={buyerId ?? buyers[0]?.id} required>
            {buyers.map((buyer) => (
              <option key={buyer.id} value={buyer.id}>
                {buyer.shopName ? `${buyer.name} — ${buyer.shopName}` : buyer.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}

      <Field label={t("forms.reminder.repeats")} error={fieldErrors.schedule}>
        <SelectInput name="schedule" defaultValue="weekly">
          <option value="weekly">{t("forms.reminder.weekly")}</option>
          <option value="date">{t("forms.reminder.oneTime")}</option>
        </SelectInput>
      </Field>

      <Field label={t("forms.reminder.dayOfWeek")} error={fieldErrors.weekday} hint={t("forms.reminder.dayOfWeekHint")}>
        <SelectInput name="weekday" defaultValue="4">
          {WEEKDAY_KEYS.map((day) => (
            <option key={day.value} value={day.value}>
              {t(day.key)}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Field label={t("forms.reminder.dueDate")} error={fieldErrors.dueDate} hint={t("forms.reminder.dueDateHint")}>
        <TextInput name="dueDate" type="date" dir="ltr" />
      </Field>

      <Field label={t("forms.reminder.expectedAmount")} error={fieldErrors.amount}>
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

      <Field label={t("forms.common.note")} error={fieldErrors.note} hint={t("forms.common.optional")}>
        <TextInput name="note" maxLength={2000} />
      </Field>

      {state.ok ? <p className="text-sm text-emerald-600 sm:col-span-2">{t("forms.reminder.added")}</p> : null}
      {state.error ? <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p> : null}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {pending ? "…" : t("reminders.add")}
        </button>
      </div>
    </form>
  );
}
