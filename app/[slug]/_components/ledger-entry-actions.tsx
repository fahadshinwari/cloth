"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteLedgerEntryAction,
  updateLedgerEntryAction,
} from "@/app/actions/buyer.actions";
import {
  deleteSupplierLedgerEntryAction,
  updateSupplierLedgerEntryAction,
} from "@/app/actions/supplier.actions";
import type { FormActionState } from "@/app/actions/partner.actions";
import { Field, SelectInput, TextInput } from "../../_components/ui";
import { useI18n } from "../../_components/i18n-provider";

export interface LedgerEntryActionData {
  id: string;
  type: string;
  amount: string;
  currency: "AFN" | "USD";
  date: string;
  note: string;
  billNo: string;
  receivedBy: string;
  locked: boolean;
}

/**
 * Edit/delete controls for one ledger row. Both operations require a reason;
 * deletes ask for it in a prompt, edits in the modal. Inventory-linked rows
 * are locked (they belong to a stock transaction).
 */
export function LedgerEntryActions({
  kind,
  entry,
  typeOptions,
  employeeNames,
  canEdit,
  canDelete,
}: {
  kind: "buyer" | "supplier";
  entry: LedgerEntryActionData;
  typeOptions: Array<{ value: string; label: string }>;
  employeeNames: string[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [localType, setLocalType] = useState(entry.type);
  const [deletePending, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState("");

  const updateAction =
    kind === "buyer" ? updateLedgerEntryAction : updateSupplierLedgerEntryAction;
  const deleteAction =
    kind === "buyer" ? deleteLedgerEntryAction : deleteSupplierLedgerEntryAction;

  const [state, formAction, pending] = useActionState(
    async (prev: FormActionState, formData: FormData) => {
      const result = await updateAction(entry.id, prev, formData);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    {} as FormActionState,
  );

  if (entry.locked) {
    return (
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:bg-zinc-800">
        {t("ledger.lockedEntry")}
      </span>
    );
  }

  if (!canEdit && !canDelete) return null;

  const handleDelete = () => {
    const reason = window.prompt(t("ledger.deleteReasonPrompt"));
    if (reason === null) return;
    if (reason.trim().length < 3) {
      setDeleteError(t("ledger.reasonRequired"));
      return;
    }
    setDeleteError("");
    startDelete(async () => {
      const result = await deleteAction(entry.id, reason);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      router.refresh();
    });
  };

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-zinc-300 px-2 py-1 text-[11px] font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {t("common.edit")}
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          disabled={deletePending}
          onClick={handleDelete}
          className="rounded-md border border-red-300 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
        >
          {deletePending ? "…" : t("common.delete")}
        </button>
      ) : null}

      {deleteError ? (
        <span className="text-[11px] text-red-600">{deleteError}</span>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 print:hidden"
          role="dialog"
          aria-modal="true"
        >
          <form
            action={formAction}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">{t("ledger.editEntry")}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-zinc-500 hover:underline"
              >
                {t("common.close")}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("forms.common.type")} error={fieldErrors.type}>
                <SelectInput
                  name="type"
                  value={localType}
                  onChange={(event) => setLocalType(event.target.value)}
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
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
                  defaultValue={entry.amount}
                />
              </Field>

              <Field label={t("forms.common.currency")} error={fieldErrors.currency}>
                <SelectInput name="currency" defaultValue={entry.currency}>
                  <option value="AFN">AFN</option>
                  <option value="USD">USD</option>
                </SelectInput>
              </Field>

              <Field label={t("forms.common.date")} error={fieldErrors.occurredAt}>
                <TextInput
                  name="occurredAt"
                  type="date"
                  dir="ltr"
                  defaultValue={entry.date.slice(0, 10)}
                />
              </Field>

              <Field label={t("forms.common.billNo")} error={fieldErrors.billNo}>
                <TextInput name="billNo" dir="ltr" maxLength={40} defaultValue={entry.billNo} />
              </Field>

              {localType === "payment" ? (
                <Field label={t("forms.common.receivedBy")} error={fieldErrors.receivedBy}>
                  <SelectInput name="receivedBy" defaultValue={entry.receivedBy}>
                    <option value="">{t("forms.common.none")}</option>
                    {employeeNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              ) : null}

              <Field label={t("forms.common.note")} error={fieldErrors.note}>
                <TextInput name="note" maxLength={2000} defaultValue={entry.note} />
              </Field>

              <div className="sm:col-span-2">
                <Field
                  label={t("forms.common.reason")}
                  error={fieldErrors.reason}
                  hint={t("forms.common.reasonHint")}
                >
                  <textarea
                    name="reason"
                    required
                    minLength={3}
                    maxLength={500}
                    rows={2}
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </Field>
              </div>
            </div>

            {state.error ? (
              <p className="mt-3 text-sm text-red-600">{state.error}</p>
            ) : null}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
              >
                {pending ? "…" : t("common.save")}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-zinc-500 hover:underline"
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
