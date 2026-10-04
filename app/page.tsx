import Link from "next/link";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { listActiveShops } from "@/lib/services/tenant.service";
import { LanguageSwitcher } from "./_components/language-switcher";

export default async function HomePage() {
  const locale = await getRequestLocale();
  const t = getTranslator(locale);

  let shops: Awaited<ReturnType<typeof listActiveShops>> = [];
  try {
    shops = await listActiveShops();
  } catch {
    shops = [];
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("home.title")}</h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{t("home.subtitle")}</p>
        </div>
        <LanguageSwitcher current={locale} />
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("home.shops")}
        </h2>

        {shops.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
            {t("home.noShops")}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {shops.map((shop) => (
              <li key={String(shop._id)}>
                <Link
                  href={`/${shop.slug}/login`}
                  className="flex h-full flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
                >
                  <span className="text-lg font-semibold">{shop.name}</span>
                  <span className="text-sm text-zinc-500">/{shop.slug}</span>
                  <span className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                    {shop.currency}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="flex gap-4 text-sm text-zinc-500">
        <Link className="hover:underline" href="/login">
          {t("login.title")}
        </Link>
        <Link className="hover:underline" href="/super-login">
          {t("login.superAdminTitle")}
        </Link>
      </footer>
    </main>
  );
}
