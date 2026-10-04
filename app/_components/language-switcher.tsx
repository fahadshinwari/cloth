"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE } from "@/lib/i18n/cookie";
import { LOCALE_LIST } from "@/lib/i18n/config";
import type { Locale } from "@/lib/constants";

export function LanguageSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeLocale(next: Locale) {
    if (next === current) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <select
        aria-label="Language"
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        value={current}
        disabled={pending}
        onChange={(event) => changeLocale(event.target.value as Locale)}
      >
        {LOCALE_LIST.map((config) => (
          <option key={config.code} value={config.code}>
            {config.label}
          </option>
        ))}
      </select>
    </label>
  );
}
