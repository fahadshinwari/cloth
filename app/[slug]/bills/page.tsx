import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { searchBills } from "@/lib/services/bill.service";
import { formatDate, formatMinorAmount } from "@/lib/i18n/format";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { Card } from "../../_components/ui";
import { PrintButton } from "../../_components/print-button";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function BillsPage({
  params,
  searchParams,
}: PageProps<"/[slug]/bills">) {
  const { slug } = await params;
  const search = await searchParams;

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

  const query = first(search.q).trim();
  const results = query ? await searchBills(String(shop._id), query) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("bills.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("bills.subtitle")}</p>
      </div>

      <Card>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {t("bills.billNo")}
            </span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder={t("bills.placeholder")}
              dir="ltr"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <button
            type="submit"
            className="inline-flex h-[38px] items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
          >
            {t("bills.search")}
          </button>
        </form>
      </Card>

      {query ? (
        <Card className="overflow-x-auto p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">
              {t("bills.resultsFor", { billNo: query })}
            </h2>
            <PrintButton targetId="bills-results" label={t("common.print")} />
          </div>
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-zinc-500">{t("bills.noResults")}</p>
          ) : (
            <div id="bills-results" data-print-root="">
            <h2 className="hidden px-4 py-2 text-lg font-semibold print:block">
              {t("bills.resultsFor", { billNo: query })}
            </h2>
            <table className="w-full min-w-[820px] text-start text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <th className="px-4 py-3 text-start font-medium">{t("bills.billNo")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("forms.common.date")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("bills.party")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("bills.kind")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("forms.common.type")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("forms.common.amount")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("forms.common.note")}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr
                    key={`${row.kind}-${row.id}`}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                  >
                    <td className="px-4 py-3 font-medium" dir="ltr">
                      {row.billNo}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.occurredAt, locale)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/${slug}/${row.kind === "buyer" ? "buyers" : "suppliers"}/${row.partyId}`}
                        className="font-medium hover:underline"
                      >
                        {row.partyName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {row.kind === "buyer" ? t("bills.buyer") : t("bills.supplier")}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {["goods", "payment", "purchase", "sale", "adjustment"].includes(row.type)
                        ? t(`bills.types.${row.type}`)
                        : row.type}
                    </td>
                    <td className="px-4 py-3 font-medium" dir="ltr">
                      {formatMinorAmount(row.amountMinor, row.currency)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{row.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
