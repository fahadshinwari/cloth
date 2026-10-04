import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import {
  buildReminderViews,
  listBuyers,
  listReminders,
} from "@/lib/services/buyer.service";
import { formatMinorAmount } from "@/lib/i18n/format";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { Card, StatusBadge } from "../../_components/ui";
import { ReminderForm } from "../_components/reminder-form";
import { ReminderRowActions } from "../_components/reminder-row-actions";

const STATE_STYLES: Record<string, string> = {
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  today: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  soon: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  upcoming: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function RemindersPage({
  params,
}: PageProps<"/[slug]/reminders">) {
  const { slug } = await params;

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

  const tenantId = String(shop._id);
  const [reminders, buyers] = await Promise.all([
    listReminders(tenantId),
    listBuyers(tenantId),
  ]);

  const buyerNames = new Map(buyers.map((buyer) => [String(buyer._id), buyer.name]));
  const views = buildReminderViews(reminders, buyerNames);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("reminders.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("reminders.subtitle")}</p>
      </div>

      <Card>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("reminders.add")}
        </h2>
        <p className="mb-4 text-xs text-zinc-500">{t("reminders.infoOnly")}</p>
        <ReminderForm buyers={buyers.map((buyer) => ({ id: String(buyer._id), name: buyer.name, shopName: buyer.shopName }))} />
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("reminders.upcoming")}
        </h2>
        {views.length === 0 ? (
          <p className="text-center text-zinc-500">{t("reminders.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-start text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <th className="px-4 py-3 text-start font-medium">{t("reminders.buyer")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("reminders.expected")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("reminders.when")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("common.status")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("partners.fields.note")}</th>
                  <th className="px-4 py-3 text-start font-medium">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {views.map((view) => (
                  <tr
                    key={String(view.reminder._id)}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/${slug}/buyers/${String(view.reminder.buyerId)}`}
                        className="font-medium hover:underline"
                      >
                        {view.buyerName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium" dir="ltr">
                      {formatMinorAmount(view.reminder.amountMinor, view.reminder.currency)}
                    </td>
                    <td className="px-4 py-3">
                      {view.reminder.schedule === "weekly"
                        ? t("reminders.everyWeek", { day: t(`reminders.weekdays.${weekdayKey(view.reminder.weekday ?? 1)}`) })
                        : view.nextDate}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_STYLES[view.state] ?? STATE_STYLES.upcoming}`}
                        >
                          {t(`reminders.states.${view.state}`)}
                        </span>
                        {!view.reminder.active ? <StatusBadge status="inactive" /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{view.reminder.note || "—"}</td>
                    <td className="px-4 py-3">
                      <ReminderRowActions
                        reminderId={String(view.reminder._id)}
                        active={view.reminder.active}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function weekdayKey(weekday: number): string {
  return [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ][weekday] ?? "monday";
}
