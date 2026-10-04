"use client";

import { useActionState } from "react";
import { recordInventoryTransactionAction } from "@/app/actions/inventory.actions";
import type { FormActionState } from "@/app/actions/partner.actions";
import { Field, SelectInput, TextInput } from "../../_components/ui";
import { useI18n } from "../../_components/i18n-provider";

function todayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export interface InventoryTransactionFormProps {
  /** Fixed cloth context, e.g. from the cloth detail page. */
  clothId?: string;
  /** Fixed supplier context, e.g. from the supplier detail page. */
  fixedSupplierId?: string;
  /** Fixed buyer context, e.g. from the buyer detail page. */
  fixedBuyerId?: string;
  cloths?: Array<{ id: string; name: string; currency?: string; pricePerMeter?: string }>;
  suppliers?: Array<{ id: string; name: string; companyName?: string }>;
  buyers?: Array<{ id: string; name: string; shopName?: string }>;
  /** Preselect the source type (purchase/sale/adjustment). */
  defaultSourceType?: "purchase" | "sale" | "adjustment";
  submitLabel: string;
}

/**
 * One form for all three flows:
 * - purchase → inventory IN + supplier payable (credit) and/or paid amount
 * - sale     → inventory OUT + buyer outstanding (credit) and/or paid amount
 * - adjustment → stock correction only, no money side
 *
 * Stock can ONLY change through this transaction — there is no direct
 * quantity edit anywhere in the UI or the service layer.
 */
export function InventoryTransactionForm({
  clothId,
  fixedSupplierId,
  fixedBuyerId,
  cloths = [],
  suppliers = [],
  buyers = [],
  defaultSourceType = "purchase",
  submitLabel,
}: InventoryTransactionFormProps) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(recordInventoryTransactionAction, {} as FormActionState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label={t("forms.inventory.sourceType")} error={fieldErrors.sourceType}>
        <SelectInput name="sourceType" defaultValue={defaultSourceType}>
          <option value="purchase">{t("forms.inventory.purchase")}</option>
          <option value="sale">{t("forms.inventory.sale")}</option>
          <option value="adjustment">{t("forms.inventory.adjustment")}</option>
        </SelectInput>
      </Field>

      <Field label={t("forms.inventory.direction")} error={fieldErrors.direction}>
        <SelectInput name="direction" defaultValue={defaultSourceType === "sale" ? "out" : "in"}>
          <option value="in">{t("forms.inventory.in")}</option>
          <option value="out">{t("forms.inventory.out")}</option>
        </SelectInput>
      </Field>

      {clothId ? (
        <input type="hidden" name="clothId" value={clothId} />
      ) : (
        <Field label={t("forms.common.cloth")} error={fieldErrors.clothId}>
          <SelectInput name="clothId" defaultValue={cloths[0]?.id} required>
            {cloths.map((cloth) => (
              <option key={cloth.id} value={cloth.id}>
                {cloth.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}

      <Field label={t("forms.inventory.quantity")} error={fieldErrors.quantityMeters}>
        <TextInput
          name="quantityMeters"
          type="number"
          step="0.001"
          min="0.001"
          required
          dir="ltr"
          inputMode="decimal"
        />
      </Field>

      <Field label={t("forms.cloth.pricePerMeter")} error={fieldErrors.pricePerMeter}>
        <TextInput
          name="pricePerMeter"
          type="number"
          step="0.01"
          min="0.01"
          defaultValue={cloths.find((c) => c.id === clothId)?.pricePerMeter}
          required
          dir="ltr"
          inputMode="decimal"
        />
      </Field>

      <Field label={t("forms.common.currency")} error={fieldErrors.currency}>
        <SelectInput name="currency" defaultValue={cloths.find((c) => c.id === clothId)?.currency ?? "AFN"}>
          <option value="AFN">AFN</option>
          <option value="USD">USD</option>
        </SelectInput>
      </Field>

      {fixedSupplierId ? (
        // Supplier context page: the party is fixed and shown as a hidden field.
        <input type="hidden" name="supplierId" value={fixedSupplierId} />
      ) : (
        <Field label={t("forms.common.supplier")} error={fieldErrors.supplierId} hint={t("forms.inventory.supplierHint")}>
          <SelectInput name="supplierId" defaultValue={suppliers.length === 1 ? suppliers[0].id : ""}>
            <option value="">{t("forms.common.none")}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.companyName ? `${supplier.name} — ${supplier.companyName}` : supplier.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}

      {fixedBuyerId ? (
        // Buyer context page: the party is fixed and shown as a hidden field.
        <input type="hidden" name="buyerId" value={fixedBuyerId} />
      ) : (
        <Field label={t("forms.common.buyer")} error={fieldErrors.buyerId} hint={t("forms.inventory.buyerHint")}>
          <SelectInput name="buyerId" defaultValue={buyers.length === 1 ? buyers[0].id : ""}>
            <option value="">{t("forms.common.none")}</option>
            {buyers.map((buyer) => (
              <option key={buyer.id} value={buyer.id}>
                {buyer.shopName ? `${buyer.name} — ${buyer.shopName}` : buyer.name}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}

      <Field
        label={t("forms.inventory.credit")}
        error={undefined}
        hint={t("forms.inventory.creditHint")}
      >
        <select
          name="credit"
          defaultValue="off"
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="off">{t("forms.inventory.creditNo")}</option>
          <option value="on">{t("forms.inventory.creditYes")}</option>
        </select>
      </Field>

      <Field
        label={t("forms.inventory.amountPaid")}
        error={fieldErrors.amountPaid}
        hint={t("forms.inventory.amountPaidHint")}
      >
        <TextInput name="amountPaid" type="number" step="0.01" min="0" dir="ltr" inputMode="decimal" />
      </Field>

      <Field label={t("forms.common.date")} error={fieldErrors.occurredAt}>
        <TextInput name="occurredAt" type="date" defaultValue={todayISO()} dir="ltr" />
      </Field>

      <Field label={t("forms.common.note")} error={fieldErrors.note} hint={t("forms.common.optional")}>
        <TextInput name="note" maxLength={2000} />
      </Field>

      {state.ok ? <p className="text-sm text-emerald-600 sm:col-span-2">{t("forms.inventory.recorded")}</p> : null}
      {state.error ? <p className="text-sm text-red-600 sm:col-span-2">{state.error}</p> : null}

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
