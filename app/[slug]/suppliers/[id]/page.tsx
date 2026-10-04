import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import {
  getSupplierById,
  getSupplierLedgerTotals,
  getSupplierLedgerView,
} from "@/lib/services/supplier.service";
import { listMovements, listCloths } from "@/lib/services/inventory.service";
import { formatDate, formatMinorAmount } from "@/lib/i18n/format";
import { formatMeters } from "@/lib/measure";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { createSupplierLedgerEntryAction, updateSupplierAction } from "@/app/actions/supplier.actions";
import { LedgerTable } from "../../_components/ledger-table";
import { LedgerFilters } from "../../_components/ledger-filters";
import { ledgerFiltersFromSearchParams } from "@/lib/ledger-params";
import { Card, StatusBadge } from "../../../_components/ui";
import { SupplierForm } from "../../_components/party-form";
import { TransactionForm } from "../../_components/transaction-form";
import { InventoryTransactionForm } from "../../_components/inventory-transaction-form";

export default async function SupplierDetailPage({
  params,
  searchParams,
}: PageProps<"/[slug]/suppliers/[id]">) {
  const { slug, id } = await params;
  const filters = ledgerFiltersFromSearchParams(await searchParams);

  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const ctx = await getAuthContext();
  if (!ctx) redirect(`/${slug}/login`);

  if (ctx.session.role === USER_ROLE.MERCHANT_ADMIN) {
    if (ctx.session.tenantSlug !== slug || ctx.session.tenantId !== String(shop._id)) {
      redirect(`/${ctx.session.tenantSlug}/dashboard`);
    }
  }

  const locale = await getRequestLocale();
  const t = getTranslator(locale);

  const tenantId = String(shop._id);
  const supplier = await getSupplierById(tenantId, id);
  if (!supplier) notFound();

  const [ledgerView, totals, movements, cloths] = await Promise.all([
    getSupplierLedgerView(tenantId, id, filters),
    getSupplierLedgerTotals(tenantId, id),
    listMovements(tenantId, { supplierId: id, limit: 100 }),
    listCloths(tenantId),
  ]);

  const clothNames = new Map(cloths.map((cloth) => [String(cloth._id), cloth.name]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/${slug}/suppliers`} className="text-sm text-zinc-500 hover:underline">
          ← {t("suppliers.title")}
        </Link>
        <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold tracking-tight">
          {supplier.name}
          <StatusBadge status={supplier.status} />
        </h1>
        {supplier.companyName ? (
          <p className="mt-1 text-sm text-zinc-500">{supplier.companyName}</p>
        ) : null}
      </div>

      {/* Payable balance — derived from ledger entries, per currency. */}
      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("suppliers.ledgerSummary")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("suppliers.purchases")}
            </div>
            <div className="mt-1 flex flex-col text-sm font-medium" dir="ltr">
              <span>{formatMinorAmount(totals.purchases.AFN, "AFN")}</span>
              <span>{formatMinorAmount(totals.purchases.USD, "USD")}</span>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("suppliers.paid")}
            </div>
            <div className="mt-1 flex flex-col text-sm font-medium" dir="ltr">
              <span>{formatMinorAmount(totals.payments.AFN, "AFN")}</span>
              <span>{formatMinorAmount(totals.payments.USD, "USD")}</span>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("suppliers.payable")}
            </div>
            <div className="mt-1 flex flex-col text-lg font-semibold" dir="ltr">
              <span>{formatMinorAmount(totals.payable.AFN, "AFN")}</span>
              <span>{formatMinorAmount(totals.payable.USD, "USD")}</span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-500">{t("buyers.noMixHint")}</p>
      </Card>

      {/* Receive clothing — creates an inventory movement; credit goes to this ledger. */}
      <Card>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("suppliers.receiveClothing")}
        </h2>
        <p className="mb-4 text-xs text-zinc-500">{t("suppliers.receiveHint")}</p>
        <InventoryTransactionForm
          defaultSourceType="purchase"
          fixedSupplierId={String(supplier._id)}
          cloths={cloths.map((cloth) => ({
            id: String(cloth._id),
            name: cloth.name,
            currency: cloth.currency,
            pricePerMeter: String(cloth.pricePerMeterMinor / 100),
          }))}
          submitLabel={t("suppliers.recordPurchase")}
        />
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("suppliers.addEntry")}
        </h2>
        <TransactionForm
          action={createSupplierLedgerEntryAction}
          hiddenIdField="supplierId"
          hiddenIdValue={String(supplier._id)}
          amountLabel={t("buyers.fields.amount")}
          typeSelector={{
            name: "type",
            options: [
              { value: "payment", label: t("suppliers.entryPayment") },
              { value: "purchase", label: t("suppliers.entryPurchase") },
            ],
          }}
          submitLabel={t("buyers.record")}
        />
      </Card>

      {/* Full ledger with filters — history is never overwritten; every
          partial payment is its own row and the payable is derived. */}
      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("suppliers.history")}
        </h2>
        <div className="mb-4">
          <LedgerFilters
            typeOptions={[
              { value: "payment", label: t("suppliers.entryPayment") },
              { value: "purchase", label: t("suppliers.entryPurchase") },
            ]}
          />
        </div>
        <LedgerTable view={ledgerView} kind="supplier" locale={locale} emptyMessage={t("buyers.noEntries")} />
      </Card>

      {movements.length > 0 ? (
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("inventory.movementsFromSupplier")}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-start text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <th className="px-4 py-3 text-start font-medium">{t("buyers.fields.date")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("inventory.fields.cloth")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("inventory.fields.quantity")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("inventory.fields.value")}</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr
                    key={String(movement._id)}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                  >
                    <td className="px-4 py-3">{formatDate(movement.occurredAt, locale)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/${slug}/inventory/${String(movement.clothId)}`}
                        className="font-medium hover:underline"
                      >
                        {clothNames.get(String(movement.clothId)) ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {movement.direction === "in" ? "+" : "−"} {formatMeters(movement.quantityMm)}
                    </td>
                    <td className="px-4 py-3 font-medium" dir="ltr">
                      {formatMinorAmount(movement.totalValueMinor, movement.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("suppliers.details")}
        </h2>
        <SupplierForm
          action={updateSupplierAction.bind(null, String(supplier._id))}
          values={{
            name: supplier.name,
            companyName: supplier.companyName,
            phone: supplier.phone,
            address: supplier.address,
            notes: supplier.notes,
            status: supplier.status,
          }}
          submitLabel={t("common.save")}
        />
      </Card>
    </div>
  );
}
