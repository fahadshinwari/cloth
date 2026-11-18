import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { getEmployeeById } from "@/lib/services/employee.service";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { updateEmployeeAction } from "@/app/actions/employee.actions";
import { Card } from "../../../_components/ui";
import { EmployeeForm } from "../../_components/employee-form";

export default async function EditEmployeePage({
  params,
}: PageProps<"/[slug]/employees/[id]">) {
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
  const employee = await getEmployeeById(String(shop._id), id);
  if (!employee) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/${slug}/employees`} className="text-sm text-zinc-500 hover:underline">
          ← {t("employees.title")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("employees.edit")}</h1>
      </div>

      <Card>
        <EmployeeForm
          action={updateEmployeeAction.bind(null, String(employee._id))}
          values={{
            name: employee.name,
            phone: employee.phone,
            role: employee.role,
            salaryAmount:
              (employee.salaryAmountMinor ?? 0) > 0 ? String(employee.salaryAmountMinor / 100) : "",
            salaryCurrency: employee.salaryCurrency ?? "AFN",
            notes: employee.notes,
            status: employee.status,
          }}
          submitLabel={t("common.save")}
          onCancelHref={`/${slug}/employees`}
        />
      </Card>
    </div>
  );
}
