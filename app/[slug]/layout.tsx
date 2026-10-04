import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { LanguageSwitcher } from "../_components/language-switcher";
import { LogoutButton } from "../_components/logout-button";
import { I18nProvider } from "../_components/i18n-provider";

export default async function TenantLayout({
  children,
  params,
}: LayoutProps<"/[slug]">) {
  const { slug } = await params;

  // The shop must exist and be active.
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const ctx = await getAuthContext();

  // Authenticated merchant admin? Their session tenant MUST match this slug.
  if (
    ctx &&
    ctx.session.role === USER_ROLE.MERCHANT_ADMIN &&
    ctx.session.tenantSlug !== slug
  ) {
    // Never allow cross-tenant access — send them to their own shop.
    redirect(`/${ctx.session.tenantSlug}/dashboard`);
  }

  // Super admins may browse tenant areas (read-only oversight); anonymous
  // users can view the shop's public pages (login) but dashboards guard below.

  const locale = await getRequestLocale();
  const t = getTranslator(locale);

  return (
    <div className="flex min-h-full flex-col" data-tenant={shop.slug}>
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold">{shop.name}</span>
            {ctx ? (
              <nav className="flex items-center gap-4 text-sm">
                <a
                  href={`/${shop.slug}/dashboard`}
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {t("nav.dashboard")}
                </a>
                <a
                  href={`/${shop.slug}/partners`}
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {t("nav.partners")}
                </a>
                <a
                  href={`/${shop.slug}/buyers`}
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {t("nav.buyers")}
                </a>
                <a
                  href={`/${shop.slug}/suppliers`}
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {t("nav.suppliers")}
                </a>
                <a
                  href={`/${shop.slug}/inventory`}
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {t("nav.inventory")}
                </a>
                <a
                  href={`/${shop.slug}/teller`}
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {t("nav.teller")}
                </a>
                <a
                  href={`/${shop.slug}/reports`}
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {t("nav.reports")}
                </a>
                <a
                  href={`/${shop.slug}/reminders`}
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {t("nav.reminders")}
                </a>
                <a
                  href={`/${shop.slug}/settings`}
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {t("nav.settings")}
                </a>
              </nav>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher current={locale} />
            {ctx ? <LogoutButton /> : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {/* Locale comes from the server-resolved cookie — client forms below
            use it via useI18n() to render Dari/Pashto translations. */}
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </main>
    </div>
  );
}
