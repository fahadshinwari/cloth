import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { listEmployees } from "@/lib/services/employee.service";
import { formatMinorAmount } from "@/lib/i18n/format";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { createEmployeeAction } from "@/app/actions/employee.actions";
import { Card, StatusBadge } from "../../_components/ui";
import { EmployeeForm } from "../_components/employee-form";
import { ModuleRowDelete } from "../_components/module-row-delete";

export default async function EmployeesPage({
  params,
}: PageProps<"/[slug]/employees">) {
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
  const employees = await listEmployees(String(shop._id));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("employees.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("employees.subtitle")}</p>
        </div>
        <Link
          href={`/${slug}/expenses`}
          className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {t("expenses.title")}
        </Link>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("employees.add")}
        </h2>
        <EmployeeForm action={createEmployeeAction} submitLabel={t("employees.record")} />
      </Card>

      <Card className="overflow-x-auto p-0">
        <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
          {t("employees.list")}
        </h2>
        {employees.length === 0 ? (
          <p className="px-4 py-6 text-center text-zinc-500">{t("employees.empty")}</p>
        ) : (
          <table className="w-full min-w-[860px] text-start text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="px-4 py-3 text-start font-medium">{t("forms.common.name")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("forms.common.phone")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("employees.fields.role")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("employees.fields.salary")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("common.status")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr
                  key={String(employee._id)}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/${slug}/employees/${String(employee._id)}`}
                      className="font-medium hover:underline"
                    >
                      {employee.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500" dir="ltr">
                    {employee.phone || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{employee.role || "—"}</td>
                  <td className="px-4 py-3" dir="ltr">
                    {(employee.salaryAmountMinor ?? 0) > 0
                      ? formatMinorAmount(employee.salaryAmountMinor, employee.salaryCurrency ?? "AFN")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={employee.status} locale={locale} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/${slug}/employees/${String(employee._id)}`}
                        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        {t("common.edit")}
                      </Link>
                      <ModuleRowDelete kind="employee" entryId={String(employee._id)} />
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
