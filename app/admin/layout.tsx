import Link from "next/link";
import { redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getSession } from "@/lib/session";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { LanguageSwitcher } from "../_components/language-switcher";
import { LogoutButton } from "../_components/logout-button";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await getSession();
  if (!session || session.role !== USER_ROLE.SUPER_ADMIN) {
    redirect("/super-login");
  }

  const locale = await getRequestLocale();
  const t = getTranslator(locale);

  return (
    <div className="flex min-h-full flex-col">
      <header className="relative border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-6">
            <Link href="/admin" className="truncate text-sm font-semibold">
              {t("common.appName")}
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/admin" className="whitespace-nowrap text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                {t("nav.shops")}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher current={locale} />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
