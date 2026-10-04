import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { getInventorySummary } from "@/lib/services/inventory.service";
import { formatMinorAmount } from "@/lib/i18n/format";
import { formatMeters } from "@/lib/measure";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { Card } from "../../_components/ui";

export default async function InventoryPage({
  params,
}: PageProps<"/[slug]/inventory">) {
  const { slug } = await params;

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

  const summary = await getInventorySummary(String(shop._id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("inventory.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("inventory.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${slug}/inventory/new`}
            className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {t("inventory.newCloth")}
          </Link>
          <Link
            href={`/${slug}/inventory/transactions/new`}
            className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
          >
            {t("inventory.newTransaction")}
          </Link>
        </div>
      </div>

      {/* Stock and value are derived from movements; value stays per currency. */}
      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("inventory.totals")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("inventory.totalMeters")}
            </div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              {formatMeters(summary.totalMetersMm)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("inventory.valueAFN")}
            </div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              {formatMinorAmount(summary.valueByCurrency.AFN, "AFN")}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("inventory.valueUSD")}
            </div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              {formatMinorAmount(summary.valueByCurrency.USD, "USD")}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-500">{t("buyers.noMixHint")}</p>
      </Card>

      {summary.cloths.length === 0 ? (
        <Card>
          <p className="text-center text-zinc-500">{t("inventory.empty")}</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-start text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="px-4 py-3 text-start font-medium">{t("inventory.fields.cloth")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("inventory.fields.category")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("inventory.totalMeters")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("inventory.fields.pricePerMeter")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("inventory.fields.value")}</th>
              </tr>
            </thead>
            <tbody>
              {summary.cloths.map(({ cloth, stockMm, valueMinor }) => (
                <tr
                  key={String(cloth._id)}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/${slug}/inventory/${String(cloth._id)}`}
                      className="font-medium hover:underline"
                    >
                      {cloth.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{cloth.category || "—"}</td>
                  <td className="px-4 py-3" dir="ltr">
                    {formatMeters(stockMm)}
                  </td>
                  <td className="px-4 py-3" dir="ltr">
                    {formatMinorAmount(cloth.pricePerMeterMinor, cloth.currency)} / m
                  </td>
                  <td className="px-4 py-3 font-medium" dir="ltr">
                    {formatMinorAmount(valueMinor, cloth.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
