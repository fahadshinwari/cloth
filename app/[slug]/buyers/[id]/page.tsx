import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import {
  buildReminderViews,
  getBuyerLedgerTotals,
  getBuyerById,
  getBuyerLedgerView,
  listReminders,
} from "@/lib/services/buyer.service";
import { listCloths, listMovements } from "@/lib/services/inventory.service";
import { formatDate, formatMinorAmount } from "@/lib/i18n/format";
import { formatMeters } from "@/lib/measure";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { createLedgerEntryAction, updateBuyerAction } from "@/app/actions/buyer.actions";
import { Card, StatusBadge } from "../../../_components/ui";
import { EntityForm } from "../../_components/entity-form";
import { TransactionForm } from "../../_components/transaction-form";

import { ReminderForm } from "../../_components/reminder-form";
import { ReminderRowActions } from "../../_components/reminder-row-actions";
import { InventoryTransactionForm } from "../../_components/inventory-transaction-form";
import { LedgerTable } from "../../_components/ledger-table";
import { LedgerFilters } from "../../_components/ledger-filters";
import { ledgerFiltersFromSearchParams } from "@/lib/ledger-params";

export default async function BuyerDetailPage({
  params,
  searchParams,
}: PageProps<"/[slug]/buyers/[id]">) {
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
  const buyer = await getBuyerById(tenantId, id);
  if (!buyer) notFound();

  const [ledgerView, totals, reminders, cloths, movements] = await Promise.all([
    getBuyerLedgerView(tenantId, id, filters),
    getBuyerLedgerTotals(tenantId, id),
    listReminders(tenantId, { buyerId: id }),
    listCloths(tenantId),
    listMovements(tenantId, { buyerId: id, limit: 100 }),
  ]);

  const reminderViews = buildReminderViews(reminders, new Map([[String(buyer._id), buyer.name]]));
  const clothNames = new Map(cloths.map((cloth) => [String(cloth._id), cloth.name]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/${slug}/buyers`} className="text-sm text-zinc-500 hover:underline">
          ← {t("buyers.title")}
        </Link>
        <h1 className="mt-2 flex items-center gap-3 text-2xl font-semibold tracking-tight">
          {buyer.name}
          <StatusBadge status={buyer.status} />
        </h1>
        {buyer.shopName ? <p className="mt-1 text-sm text-zinc-500">{buyer.shopName}</p> : null}
      </div>

      {/* Outstanding balance — derived from ledger entries, per currency. */}
      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("buyers.ledgerSummary")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("buyers.goodsGiven")}
            </div>
            <div className="mt-1 flex flex-col text-sm font-medium" dir="ltr">
              <span>{formatMinorAmount(totals.goods.AFN, "AFN")}</span>
              <span>{formatMinorAmount(totals.goods.USD, "USD")}</span>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("buyers.paymentsReceived")}
            </div>
            <div className="mt-1 flex flex-col text-sm font-medium" dir="ltr">
              <span>{formatMinorAmount(totals.payments.AFN, "AFN")}</span>
              <span>{formatMinorAmount(totals.payments.USD, "USD")}</span>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("buyers.outstanding")}
            </div>
            <div className="mt-1 flex flex-col text-lg font-semibold" dir="ltr">
              <span>{formatMinorAmount(totals.outstanding.AFN, "AFN")}</span>
              <span>{formatMinorAmount(totals.outstanding.USD, "USD")}</span>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-500">{t("buyers.noMixHint")}</p>
      </Card>

      {/* Give/sell clothing — creates an inventory movement; credit goes to this ledger. */}
      {cloths.length > 0 ? (
        <Card>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("buyers.sellClothing")}
          </h2>
          <p className="mb-4 text-xs text-zinc-500">{t("buyers.sellHint")}</p>
          <InventoryTransactionForm
            defaultSourceType="sale"
            fixedBuyerId={String(buyer._id)}
            cloths={cloths.map((cloth) => ({
              id: String(cloth._id),
              name: cloth.name,
              currency: cloth.currency,
              pricePerMeter: String(cloth.pricePerMeterMinor / 100),
            }))}
            buyers={[
              { id: String(buyer._id), name: buyer.name, shopName: buyer.shopName },
            ]}
            submitLabel={t("buyers.recordSale")}
          />
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("buyers.addEntry")}
        </h2>
        <TransactionForm
          action={createLedgerEntryAction}
          hiddenIdField="buyerId"
          hiddenIdValue={String(buyer._id)}
          amountLabel={t("buyers.fields.amount")}
          typeSelector={{
            name: "type",
            options: [
              { value: "goods", label: t("buyers.entryGoods") },
              { value: "payment", label: t("buyers.entryPayment") },
            ],
          }}
          submitLabel={t("buyers.record")}
        />
      </Card>

      {/* Full ledger with filters — history is never overwritten; every
          partial payment is its own row and the balance is derived. */}
      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("buyers.history")}
        </h2>
        <div className="mb-4">
          <LedgerFilters
            typeOptions={[
              { value: "goods", label: t("buyers.entryGoods") },
              { value: "payment", label: t("buyers.entryPayment") },
            ]}
          />
        </div>
        <LedgerTable view={ledgerView} kind="buyer" locale={locale} emptyMessage={t("buyers.noEntries")} />
      </Card>

      {movements.length > 0 ? (
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("inventory.movementsToBuyer")}
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

      {/* Reminders for this buyer — informational only, never touch the ledger. */}
      <Card>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("reminders.title")}
        </h2>
        <p className="mb-4 text-xs text-zinc-500">{t("reminders.infoOnly")}</p>

        {reminderViews.length > 0 ? (
          <ul className="mb-6 flex flex-col gap-2">
            {reminderViews.map((view) => (
              <li
                key={String(view.reminder._id)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <span dir="ltr">
                  {formatMinorAmount(view.reminder.amountMinor, view.reminder.currency)}
                  {" — "}
                  {view.reminder.schedule === "weekly"
                    ? t("reminders.everyWeek", { day: weekdayLabel(view.reminder.weekday ?? 1, t) })
                    : formatDate(view.reminder.dueDate ?? new Date(), locale, { timeStyle: undefined })}
                </span>
                <ReminderRowActions
                  reminderId={String(view.reminder._id)}
                  active={view.reminder.active}
                />
              </li>
            ))}
          </ul>
        ) : null}

        <ReminderForm buyerId={String(buyer._id)} buyerIdFixed />
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("buyers.details")}
        </h2>
        <EntityForm
          action={updateBuyerAction.bind(null, String(buyer._id))}
          withShopName
          values={{
            name: buyer.name,
            shopName: buyer.shopName,
            phone: buyer.phone,
            address: buyer.address,
            notes: buyer.notes,
            status: buyer.status,
          }}
          submitLabel={t("common.save")}
        />
      </Card>
    </div>
  );
}

function weekdayLabel(
  weekday: number,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const keys = [
    "reminders.weekdays.sunday",
    "reminders.weekdays.monday",
    "reminders.weekdays.tuesday",
    "reminders.weekdays.wednesday",
    "reminders.weekdays.thursday",
    "reminders.weekdays.friday",
    "reminders.weekdays.saturday",
  ];
  return t(keys[weekday] ?? "reminders.weekdays.monday");
}
