"use client";

import Link from "next/link";
import { REPORT_TYPES } from "@/lib/report-params";
import { useI18n } from "../../_components/i18n-provider";

export function ReportTypeNav({ slug, current }: { slug: string; current: string }) {
  const { t } = useI18n();

  return (
    <nav className="flex flex-wrap gap-2" dir="ltr">
      {REPORT_TYPES.map((type) => (
        <Link
          key={type}
          href={`/${slug}/reports?type=${type}`}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
            type === current
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          }`}
        >
          {t(`forms.reportTypes.${type}`)}
        </Link>
      ))}
    </nav>
  );
}
