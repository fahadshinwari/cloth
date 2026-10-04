import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { getBuyersWithLedgerTotals } from "@/lib/services/buyer.service";
import { formatMinorAmount } from "@/lib/i18n/format";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { Card, StatusBadge } from "../../_components/ui";

export default async function BuyersPage({
  params,
}: PageProps<"/[slug]/buyers">) {
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

  const { overall, buyers } = await getBuyersWithLedgerTotals(String(shop._id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("buyers.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("buyers.subtitle")}</p>
        </div>
        <Link
          href={`/${slug}/buyers/new`}
          className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
        >
          {t("buyers.new")}
        </Link>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("buyers.totals")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("buyers.outstandingAFN")}
            </div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              {formatMinorAmount(overall.outstanding.AFN, "AFN")}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("buyers.outstandingUSD")}
            </div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              {formatMinorAmount(overall.outstanding.USD, "USD")}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("buyers.count")}
            </div>
            <div className="mt-1 text-lg font-semibold">{buyers.length}</div>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-500">{t("buyers.noMixHint")}</p>
      </Card>

      {buyers.length === 0 ? (
        <Card>
          <p className="text-center text-zinc-500">{t("buyers.empty")}</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-start text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="px-4 py-3 text-start font-medium">{t("buyers.fields.name")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("buyers.fields.shopName")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("buyers.fields.phone")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("buyers.outstandingAFN")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("buyers.outstandingUSD")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {buyers.map(({ buyer, totals }) => (
                <tr
                  key={String(buyer._id)}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/${slug}/buyers/${String(buyer._id)}`}
                      className="font-medium hover:underline"
                    >
                      {buyer.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{buyer.shopName || "—"}</td>
                  <td className="px-4 py-3" dir="ltr">
                    {buyer.phone || "—"}
                  </td>
                  <td className="px-4 py-3 font-medium" dir="ltr">
                    {formatMinorAmount(totals.outstanding.AFN, "AFN")}
                  </td>
                  <td className="px-4 py-3 font-medium" dir="ltr">
                    {formatMinorAmount(totals.outstanding.USD, "USD")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={buyer.status} />
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
