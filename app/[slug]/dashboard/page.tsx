import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { countPartners, getInvestmentGrandTotals } from "@/lib/services/partner.service";
import {
  buildReminderViews,
  getBuyersWithLedgerTotals,
  listReminders,
} from "@/lib/services/buyer.service";
import {
  getSuppliersWithLedgerTotals,
} from "@/lib/services/supplier.service";
import { getInventorySummary } from "@/lib/services/inventory.service";
import { getTellerBalance } from "@/lib/services/teller.service";
import { formatMinorAmount } from "@/lib/i18n/format";
import { formatMeters } from "@/lib/measure";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { Card } from "../../_components/ui";

function MoneyPair({
  afn,
  usd,
  size = "md",
}: {
  afn: number;
  usd: number;
  size?: "sm" | "md" | "lg";
}) {
  const cls = {
    sm: "text-sm font-medium",
    md: "text-lg font-semibold",
    lg: "text-2xl font-semibold",
  }[size];
  return (
    <div className="flex flex-col" dir="ltr">
      <span className={cls}>{formatMinorAmount(afn, "AFN")}</span>
      <span className={cls}>{formatMinorAmount(usd, "USD")}</span>
    </div>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-zinc-300 px-3 py-2 text-center text-sm font-medium transition hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      {label}
    </Link>
  );
}

export default async function TenantDashboardPage({
  params,
}: PageProps<"/[slug]/dashboard">) {
  const { slug } = await params;

  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const ctx = await getAuthContext();
  if (!ctx) {
    redirect(`/${slug}/login`);
  }

  // Merchant admin can ONLY ever see their own tenant, verified from the
  // signed session — never from the URL or any client input.
  if (ctx.session.role === USER_ROLE.MERCHANT_ADMIN) {
    if (ctx.session.tenantSlug !== slug || ctx.session.tenantId !== String(shop._id)) {
      redirect(`/${ctx.session.tenantSlug}/dashboard`);
    }
  }

  const locale = await getRequestLocale();
  const t = getTranslator(locale);

  const tenantId = String(shop._id);

  const [
    partnerCount,
    investmentTotals,
    buyerData,
    supplierData,
    inventory,
    teller,
    reminders,
  ] = await Promise.all([
    countPartners(tenantId),
    getInvestmentGrandTotals(tenantId),
    getBuyersWithLedgerTotals(tenantId),
    getSuppliersWithLedgerTotals(tenantId),
    getInventorySummary(tenantId),
    getTellerBalance(tenantId),
    listReminders(tenantId, { activeOnly: true }),
  ]);

  const buyerNames = new Map(
    buyerData.buyers.map(({ buyer }) => [String(buyer._id), buyer.name]),
  );
  const reminderViews = buildReminderViews(reminders, buyerNames);
  const overdueCount = reminderViews.filter((v) => v.state === "overdue").length;
  const todayCount = reminderViews.filter((v) => v.state === "today").length;
  const upcoming = reminderViews.filter((v) => v.state === "soon" || v.state === "upcoming").slice(0, 5);

  // Buyers/suppliers with a non-zero outstanding balance.
  const buyersWithBalance = buyerData.buyers.filter(
    ({ totals }) => totals.outstanding.AFN !== 0 || totals.outstanding.USD !== 0,
  ).length;
  const suppliersWithBalance = supplierData.suppliers.filter(
    ({ totals }) => totals.payable.AFN !== 0 || totals.payable.USD !== 0,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("dashboard.welcome")}, {ctx.user.name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{t("dashboard.merchantTitle")}</p>
      </div>

      {/* Quick actions */}
      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("dashboard.quickActions")}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <QuickAction href={`/${slug}/buyers/new`} label={t("qa.addBuyer")} />
          <QuickAction href={`/${slug}/suppliers/new`} label={t("qa.addSupplier")} />
          <QuickAction href={`/${slug}/inventory/new`} label={t("qa.addCloth")} />
          <QuickAction href={`/${slug}/inventory/transactions/new`} label={t("qa.recordSale")} />
          <QuickAction href={`/${slug}/inventory/transactions/new`} label={t("qa.recordPurchase")} />
          <QuickAction href={`/${slug}/buyers`} label={t("qa.recordPayment")} />
          <QuickAction href={`/${slug}/partners/new`} label={t("qa.addInvestment")} />
          <QuickAction href={`/${slug}/teller`} label={t("qa.tellerTx")} />
        </div>
      </Card>

      {/* 1. Partners / investment */}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("dashboard.sectionPartners")}
          </h2>
          <Link href={`/${slug}/partners`} className="text-sm text-zinc-500 hover:underline">
            {t("partners.viewAll")} →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">{t("partners.totalInvestment")}</div>
            <MoneyPair afn={investmentTotals.AFN} usd={investmentTotals.USD} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">{t("partners.count")}</div>
            <div className="mt-1 text-lg font-semibold">{partnerCount}</div>
          </div>
        </div>
      </Card>

      {/* 2. Money in market */}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("dashboard.sectionMarket")}
          </h2>
          <Link href={`/${slug}/buyers`} className="text-sm text-zinc-500 hover:underline">
            {t("buyers.viewAll")} →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">{t("buyers.outstanding")}</div>
            <MoneyPair afn={buyerData.overall.outstanding.AFN} usd={buyerData.overall.outstanding.USD} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">{t("dashboard.buyersWithBalance")}</div>
            <div className="mt-1 text-lg font-semibold">{buyersWithBalance}</div>
          </div>
        </div>
      </Card>

      {/* 3. Money owed to suppliers */}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("dashboard.sectionSuppliers")}
          </h2>
          <Link href={`/${slug}/suppliers`} className="text-sm text-zinc-500 hover:underline">
            {t("suppliers.viewAll")} →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">{t("suppliers.payable")}</div>
            <MoneyPair afn={supplierData.overall.payable.AFN} usd={supplierData.overall.payable.USD} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">{t("dashboard.suppliersWithBalance")}</div>
            <div className="mt-1 text-lg font-semibold">{suppliersWithBalance}</div>
          </div>
        </div>
      </Card>

      {/* 4. Cloth inventory */}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("dashboard.sectionInventory")}
          </h2>
          <Link href={`/${slug}/inventory`} className="text-sm text-zinc-500 hover:underline">
            {t("inventory.viewAll")} →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">{t("inventory.totalMeters")}</div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              {formatMeters(inventory.totalMetersMm)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">{t("inventory.valueAFN")}</div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              {formatMinorAmount(inventory.valueByCurrency.AFN, "AFN")}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">{t("inventory.valueUSD")}</div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              {formatMinorAmount(inventory.valueByCurrency.USD, "USD")}
            </div>
          </div>
        </div>
        {inventory.lowStock.length > 0 ? (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {t("dashboard.lowStockWarning", { count: inventory.lowStock.length })}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {inventory.lowStock.map(({ cloth, stockMm }) => (
                <li key={String(cloth._id)}>
                  <Link
                    href={`/${slug}/inventory/${String(cloth._id)}`}
                    className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 hover:underline dark:bg-amber-900/60 dark:text-amber-200"
                    dir="ltr"
                  >
                    {cloth.name}: {formatMeters(stockMm)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      {/* 5. Teller cash */}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("dashboard.sectionTeller")}
          </h2>
          <Link href={`/${slug}/teller`} className="text-sm text-zinc-500 hover:underline">
            {t("teller.viewAll")} →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">{t("teller.cashAFN")}</div>
            <div className="mt-1 text-2xl font-semibold" dir="ltr">
              {formatMinorAmount(teller.AFN, "AFN")}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">{t("teller.cashUSD")}</div>
            <div className="mt-1 text-2xl font-semibold" dir="ltr">
              {formatMinorAmount(teller.USD, "USD")}
            </div>
          </div>
        </div>
      </Card>

      {/* 6. Payment reminders */}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {t("dashboard.sectionReminders")}
          </h2>
          <Link href={`/${slug}/reminders`} className="text-sm text-zinc-500 hover:underline">
            {t("reminders.viewAll")} →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-red-200 px-3 py-2 dark:border-red-900">
            <div className="text-xs uppercase tracking-wide text-zinc-500">{t("reminders.states.overdue")}</div>
            <div className="mt-1 text-lg font-semibold">{overdueCount}</div>
          </div>
          <div className="rounded-md border border-amber-200 px-3 py-2 dark:border-amber-900">
            <div className="text-xs uppercase tracking-wide text-zinc-500">{t("reminders.today")}</div>
            <div className="mt-1 text-lg font-semibold">{todayCount}</div>
          </div>
          <div className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <div className="text-xs uppercase tracking-wide text-zinc-500">{t("reminders.states.upcoming")}</div>
            <div className="mt-1 text-lg font-semibold">{upcoming.length}</div>
          </div>
        </div>
        {reminderViews.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">{t("reminders.empty")}</p>
        ) : upcoming.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {upcoming.map((view) => (
              <li
                key={String(view.reminder._id)}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <span className="font-medium">{view.buyerName}</span>
                <span dir="ltr">{formatMinorAmount(view.reminder.amountMinor, view.reminder.currency)}</span>
                <span className="text-zinc-500">{view.nextDate}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <div className="grid gap-2 sm:grid-cols-3">
        <Link
          href={`/${shop.slug}/settings`}
          className="text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
        >
          {t("nav.settings")} →
        </Link>
      </div>
    </div>
  );
}
