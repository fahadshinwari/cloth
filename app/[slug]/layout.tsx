import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { LanguageSwitcher } from "../_components/language-switcher";
import { LogoutButton } from "../_components/logout-button";
import { I18nProvider } from "../_components/i18n-provider";
import { TenantNav, type TenantNavItem } from "../_components/tenant-nav";

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

  const navItems: TenantNavItem[] = ctx
    ? [
        { href: `/${shop.slug}/dashboard`, label: t("nav.dashboard") },
        { href: `/${shop.slug}/partners`, label: t("nav.partners") },
        { href: `/${shop.slug}/buyers`, label: t("nav.buyers") },
        { href: `/${shop.slug}/suppliers`, label: t("nav.suppliers") },
        { href: `/${shop.slug}/inventory`, label: t("nav.inventory") },
        { href: `/${shop.slug}/teller`, label: t("nav.teller") },
        { href: `/${shop.slug}/reports`, label: t("nav.reports") },
        { href: `/${shop.slug}/reminders`, label: t("nav.reminders") },
        { href: `/${shop.slug}/settings`, label: t("nav.settings") },
      ]
    : [];

  return (
    <div className="flex min-h-full flex-col" data-tenant={shop.slug}>
      <header className="relative border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate text-sm font-semibold sm:text-base">{shop.name}</span>
          </div>
          {ctx ? (
            <nav className="hidden items-center gap-4 text-sm xl:flex">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}
          <div className="flex items-center gap-2">
            {ctx ? <TenantNav items={navItems} /> : null}
            <LanguageSwitcher current={locale} />
            {ctx ? <LogoutButton /> : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* Locale comes from the server-resolved cookie — client forms below
            use it via useI18n() to render Dari/Pashto translations. */}
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </main>
    </div>
  );
}
