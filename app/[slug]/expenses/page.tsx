import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { getExpenseTotals, listExpenses } from "@/lib/services/expense.service";
import { listEmployees } from "@/lib/services/employee.service";
import { formatDate, formatMinorAmount } from "@/lib/i18n/format";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { createExpenseAction } from "@/app/actions/expense.actions";
import { Card } from "../../_components/ui";
import { ExpenseForm } from "../_components/expense-form";
import { ModuleRowDelete } from "../_components/module-row-delete";

export default async function ExpensesPage({
  params,
}: PageProps<"/[slug]/expenses">) {
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
  const [expenses, totals, employees] = await Promise.all([
    listExpenses(tenantId),
    getExpenseTotals(tenantId),
    listEmployees(tenantId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("expenses.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("expenses.subtitle")}</p>
        </div>
        <Link
          href={`/${slug}/employees`}
          className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {t("employees.title")}
        </Link>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("expenses.totals")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">{t("expenses.totalAFN")}</div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              {formatMinorAmount(totals.AFN, "AFN")}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">{t("expenses.totalUSD")}</div>
            <div className="mt-1 text-lg font-semibold" dir="ltr">
              {formatMinorAmount(totals.USD, "USD")}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-500">{t("buyers.noMixHint")}</p>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("expenses.add")}
        </h2>
        <ExpenseForm
          action={createExpenseAction}
          submitLabel={t("expenses.record")}
          employees={employees.map((employee) => ({
            id: String(employee._id),
            name: employee.name,
            salaryAmount:
              (employee.salaryAmountMinor ?? 0) > 0 ? String(employee.salaryAmountMinor / 100) : "",
            salaryCurrency: employee.salaryCurrency ?? "AFN",
          }))}
        />
      </Card>

      <Card className="overflow-x-auto p-0">
        <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
          {t("expenses.history")}
        </h2>
        {expenses.length === 0 ? (
          <p className="px-4 py-6 text-center text-zinc-500">{t("expenses.empty")}</p>
        ) : (
          <table className="w-full min-w-[820px] text-start text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="px-4 py-3 text-start font-medium">{t("forms.common.date")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("expenses.fields.category")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("expenses.fields.name")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("forms.common.amount")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("forms.common.note")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr
                  key={String(expense._id)}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(expense.occurredAt, locale)}</td>
                  <td className="px-4 py-3">{t(`expenses.categories.${expense.category}`)}</td>
                  <td className="px-4 py-3 text-zinc-500">{expense.name || "—"}</td>
                  <td className="px-4 py-3 font-medium" dir="ltr">
                    {formatMinorAmount(expense.amountMinor, expense.currency)}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{expense.note || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/${slug}/expenses/${String(expense._id)}`}
                        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        {t("common.edit")}
                      </Link>
                      <ModuleRowDelete kind="expense" entryId={String(expense._id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
