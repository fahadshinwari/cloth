import type { Metadata } from "next";
import "./globals.css";
import { getRequestLocale, LOCALE_COOKIE } from "@/lib/i18n/request";
import { getDirection } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = {
  title: "Wholesale Manager",
  description: "Multi-tenant wholesale clothing merchant management",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getRequestLocale();
  const dir = getDirection(locale);
  const t = getTranslator(locale);

  return (
    <html lang={locale} dir={dir} className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {children}
        {/* Keep locale cookie name referenced so it survives refactors */}
        <span hidden data-locale-cookie={LOCALE_COOKIE} data-app-name={t("common.appName")} />
      </body>
    </html>
  );
}
