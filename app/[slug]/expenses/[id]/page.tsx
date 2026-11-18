import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { getExpenseById } from "@/lib/services/expense.service";
import { listEmployees } from "@/lib/services/employee.service";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { updateExpenseAction } from "@/app/actions/expense.actions";
import { Card } from "../../../_components/ui";
import { ExpenseForm } from "../../_components/expense-form";

export default async function EditExpensePage({
  params,
}: PageProps<"/[slug]/expenses/[id]">) {
  const { slug, id } = await params;

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

  const expense = await getExpenseById(String(shop._id), id);
  if (!expense) notFound();
  const employees = await listEmployees(String(shop._id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/${slug}/expenses`} className="text-sm text-zinc-500 hover:underline">
          ← {t("expenses.title")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("expenses.edit")}</h1>
      </div>

      <Card>
        <ExpenseForm
          action={updateExpenseAction.bind(null, String(expense._id))}
          values={{
            category: expense.category,
            name: expense.name,
            employeeId: expense.employeeId ? String(expense.employeeId) : "",
            amount: String(expense.amountMinor / 100),
            currency: expense.currency,
            occurredAt: expense.occurredAt.toISOString().slice(0, 10),
            note: expense.note,
          }}
          employees={employees.map((employee) => ({
            id: String(employee._id),
            name: employee.name,
            salaryAmount:
              (employee.salaryAmountMinor ?? 0) > 0 ? String(employee.salaryAmountMinor / 100) : "",
            salaryCurrency: employee.salaryCurrency ?? "AFN",
          }))}
          submitLabel={t("common.save")}
          onCancelHref={`/${slug}/expenses`}
        />
      </Card>
    </div>
  );
}
