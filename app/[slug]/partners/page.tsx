import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import {
  getPartnerInvestmentTotals,
  getInvestmentGrandTotals,
  listPartners,
} from "@/lib/services/partner.service";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { Card, StatusBadge } from "../../_components/ui";

export default async function PartnersPage({
  params,
}: PageProps<"/[slug]/partners">) {
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

  const tenantId = String(shop._id);
  const [partners, totalsByPartner, grandTotals] = await Promise.all([
    listPartners(tenantId),
    getPartnerInvestmentTotals(tenantId),
    getInvestmentGrandTotals(tenantId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("partners.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("partners.subtitle")}</p>
        </div>
        <Link
          href={`/${slug}/partners/new`}
          className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
        >
          {t("partners.new")}
        </Link>
      </div>

      {/* Grand totals — AFN and USD are NEVER merged into one number. */}
      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("partners.totals")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("partners.totalAFN")}
            </div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              {grandTotals.display.AFN.toLocaleString("en-US")} AFN
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("partners.totalUSD")}
            </div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              {grandTotals.display.USD.toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              {t("partners.count")}
            </div>
            <div className="mt-1 text-lg font-semibold">{partners.length}</div>
          </div>
        </div>
      </Card>

      {partners.length === 0 ? (
        <Card>
          <p className="text-center text-zinc-500">{t("partners.empty")}</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-start text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="px-4 py-3 text-start font-medium">{t("partners.fields.name")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("partners.fields.phone")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("partners.investedAFN")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("partners.investedUSD")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("common.status")}</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => {
                const totals = totalsByPartner.get(String(partner._id));
                return (
                  <tr
                    key={String(partner._id)}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/${slug}/partners/${String(partner._id)}`}
                        className="font-medium hover:underline"
                      >
                        {partner.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {partner.phone || "—"}
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {(totals?.display.AFN ?? 0).toLocaleString("en-US")} AFN
                    </td>
                    <td className="px-4 py-3" dir="ltr">
                      {(totals?.display.USD ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} USD
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={partner.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
