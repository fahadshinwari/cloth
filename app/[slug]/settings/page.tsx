import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { Card } from "../../_components/ui";

export default async function TenantSettingsPage({
  params,
}: PageProps<"/[slug]/settings">) {
  const { slug } = await params;

  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const ctx = await getAuthContext();
  if (!ctx) {
    redirect(`/${slug}/login`);
  }

  if (ctx.session.role === USER_ROLE.MERCHANT_ADMIN) {
    if (ctx.session.tenantSlug !== slug || ctx.session.tenantId !== String(shop._id)) {
      redirect(`/${ctx.session.tenantSlug}/dashboard`);
    }
  }

  const locale = await getRequestLocale();
  const t = getTranslator(locale);

  const rows: Array<{ label: string; value: string; ltr?: boolean }> = [
    { label: t("admin.fields.name"), value: shop.name },
    { label: t("admin.fields.slug"), value: `/${shop.slug}`, ltr: true },
    { label: t("admin.fields.adminName"), value: ctx.user.name },
    { label: t("admin.fields.adminEmail"), value: ctx.user.email, ltr: true },
    { label: t("admin.fields.phone"), value: shop.phone, ltr: true },
    { label: t("admin.fields.currency"), value: shop.currency },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("settings.shopInfo")}
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">{row.label}</dt>
              <dd className="mt-1 text-sm font-medium" dir={row.ltr ? "ltr" : undefined}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-xs text-zinc-500">{t("settings.readMore")}</p>
      </Card>
    </div>
  );
}
