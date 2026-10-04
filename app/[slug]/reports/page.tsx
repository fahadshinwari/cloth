import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { listBuyers } from "@/lib/services/buyer.service";
import { listSuppliers } from "@/lib/services/supplier.service";
import { listCloths } from "@/lib/services/inventory.service";
import { buildReportTable } from "@/lib/report-export";
import { parseReportParams, toReportFilters, REPORT_TYPES } from "@/lib/report-params";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { Card } from "../../_components/ui";
import { ReportTypeNav } from "../_components/report-type-nav";

interface ReportsPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReportsPage({ params, searchParams }: ReportsPageProps) {
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

  // Defaults: daily report for the last 30 days.
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const type = (typeof search.type === "string" && REPORT_TYPES.includes(search.type as never)
    ? search.type
    : "daily") as (typeof REPORT_TYPES)[number];

  const resolved: Record<string, string> = {
    type,
    from: typeof search.from === "string" ? search.from : defaultFrom.toISOString().slice(0, 10),
    to: typeof search.to === "string" ? search.to : new Date().toISOString().slice(0, 10),
    currency: typeof search.currency === "string" ? search.currency : "",
    transactionType: typeof search.transactionType === "string" ? search.transactionType : "",
    buyerId: typeof search.buyerId === "string" ? search.buyerId : "",
    supplierId: typeof search.supplierId === "string" ? search.supplierId : "",
    clothId: typeof search.clothId === "string" ? search.clothId : "",
    bucket: typeof search.bucket === "string" ? search.bucket : "",
  };

  const parsed = parseReportParams({
    type,
    format: "csv",
    from: resolved.from,
    to: resolved.to,
    currency: resolved.currency || undefined,
    transactionType: resolved.transactionType || undefined,
    buyerId: resolved.buyerId || undefined,
    supplierId: resolved.supplierId || undefined,
    clothId: resolved.clothId || undefined,
    bucket: resolved.bucket || undefined,
  });

  const [buyers, suppliers, cloths] = await Promise.all([
    listBuyers(String(shop._id)),
    listSuppliers(String(shop._id)),
    listCloths(String(shop._id)),
  ]);

  let table = null;
  let errors: Record<string, string> | null = null;
  if (parsed.success) {
    table = await buildReportTable(String(shop._id), parsed.data.type, toReportFilters(parsed.data), parsed.data.bucket ?? "day");
  } else {
    errors = parsed.errors;
  }

  // Build the export query string (format chosen by the buttons).
  const exportQuery = new URLSearchParams();
  exportQuery.set("type", type);
  exportQuery.set("from", resolved.from);
  exportQuery.set("to", resolved.to);
  if (resolved.currency) exportQuery.set("currency", resolved.currency);
  if (resolved.transactionType) exportQuery.set("transactionType", resolved.transactionType);
  if (resolved.buyerId) exportQuery.set("buyerId", resolved.buyerId);
  if (resolved.supplierId) exportQuery.set("supplierId", resolved.supplierId);
  if (resolved.clothId) exportQuery.set("clothId", resolved.clothId);
  if (resolved.bucket) exportQuery.set("bucket", resolved.bucket);
  const exportBase = `/api/tenants/${slug}/reports/export?${exportQuery.toString()}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("reports.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("reports.subtitle")}</p>
      </div>

      <Card>
        <ReportTypeNav slug={slug} current={type} />

        {/* Filters: date range, currency, buyer, supplier, cloth, transaction type */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">From</span>
            <input type="date" name="from" form="report-filters" defaultValue={resolved.from} dir="ltr" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">To</span>
            <input type="date" name="to" form="report-filters" defaultValue={resolved.to} dir="ltr" className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Currency</span>
            <select name="currency" form="report-filters" defaultValue={resolved.currency} className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="">All</option>
              <option value="AFN">AFN</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Transaction type</span>
            <select name="transactionType" form="report-filters" defaultValue={resolved.transactionType} className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="">All</option>
              <option value="goods">Goods given</option>
              <option value="payment">Payment</option>
              <option value="purchase">Purchase</option>
              <option value="add">Cash in</option>
              <option value="remove">Cash out</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Buyer</span>
            <select name="buyerId" form="report-filters" defaultValue={resolved.buyerId} className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="">All</option>
              {buyers.map((buyer) => (
                <option key={String(buyer._id)} value={String(buyer._id)}>{buyer.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Supplier</span>
            <select name="supplierId" form="report-filters" defaultValue={resolved.supplierId} className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="">All</option>
              {suppliers.map((supplier) => (
                <option key={String(supplier._id)} value={String(supplier._id)}>{supplier.name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Cloth</span>
            <select name="clothId" form="report-filters" defaultValue={resolved.clothId} className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
              <option value="">All</option>
              {cloths.map((cloth) => (
                <option key={String(cloth._id)} value={String(cloth._id)}>{cloth.name}</option>
              ))}
              <option value="">—</option>
            </select>
          </label>
        </div>

        <form id="report-filters" method="get" className="mt-3">
          <input type="hidden" name="type" value={type} />
          <button type="submit" className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900">
            Apply filters
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <a href={`${exportBase}&format=csv`} className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            {t("reports.downloadCsv")}
          </a>
          <a href={`${exportBase}&format=pdf`} className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            {t("reports.downloadPdf")}
          </a>
        </div>
      </Card>

      {errors ? (
        <Card>
          <p className="text-sm text-red-600">{Object.values(errors).join(", ")}</p>
        </Card>
      ) : null}

      {table ? (
        <Card className="overflow-x-auto p-0">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">{table.title}</h2>
            {table.meta.length > 0 ? (
              <p className="mt-1 text-xs text-zinc-500" dir="ltr">
                {table.meta.map(([key, value]) => `${key}: ${value}`).join(" · ")}
              </p>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-start text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  {table.columns.map((column) => (
                    <th key={column} className="px-4 py-3 text-start font-medium">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.length === 0 ? (
                  <tr>
                    <td colSpan={table.columns.length} className="px-4 py-6 text-center text-zinc-500">
                      {t("reports.empty")}
                    </td>
                  </tr>
                ) : (
                  table.rows.map((row, index) => (
                    <tr key={index} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-3" dir={cellIndex === 0 ? undefined : "ltr"}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {table.sections?.map((section) => (
            <div key={section.title} className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{section.title}</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-start text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                      {section.columns.map((column) => (
                        <th key={column} className="px-4 py-2 text-start font-medium">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row, index) => (
                      <tr key={index} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-4 py-2" dir={cellIndex === 0 ? undefined : "ltr"}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
