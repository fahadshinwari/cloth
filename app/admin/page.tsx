import Link from "next/link";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { listShops } from "@/lib/services/tenant.service";
import { formatDate, formatNumber } from "@/lib/i18n/format";
import { Card, StatusBadge } from "../_components/ui";
import { ShopRowActions } from "./_components/shop-row-actions";

export default async function AdminDashboardPage() {
  const locale = await getRequestLocale();
  const t = getTranslator(locale);
  const shops = await listShops();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("admin.shops")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("admin.shopsCount", { count: formatNumber(shops.length, locale) })}
          </p>
        </div>
        <Link
          href="/admin/shops/new"
          className="inline-flex h-10 items-center rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
        >
          {t("admin.newShop")}
        </Link>
      </div>

      {shops.length === 0 ? (
        <Card>
          <p className="text-center text-zinc-500">{t("admin.empty")}</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-start text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-start text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="px-4 py-3 text-start font-medium">{t("admin.fields.name")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("admin.fields.slug")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("admin.fields.adminEmail")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("admin.fields.phone")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("admin.fields.currency")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("common.status")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => (
                <tr
                  key={String(shop._id)}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="px-4 py-3">
                    <Link href={`/admin/shops/${String(shop._id)}`} className="font-medium hover:underline">
                      {shop.name}
                    </Link>
                    <div className="text-xs text-zinc-500">
                      {t("nav.dashboard")}: /{shop.slug}/dashboard
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">/{shop.slug}</td>
                  <td className="px-4 py-3">{shop.adminEmail}</td>
                  <td className="px-4 py-3" dir="ltr">
                    {shop.phone}
                  </td>
                  <td className="px-4 py-3">{shop.currency}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={shop.status} />
                    <div className="mt-1 text-xs text-zinc-500">{formatDate(shop.updatedAt ?? new Date(), locale)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <ShopRowActions shopId={String(shop._id)} status={shop.status} />
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
