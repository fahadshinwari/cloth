import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { listShopUsers } from "@/lib/services/user.service";
import { listRoles } from "@/lib/services/role.service";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { createShopUserAction } from "@/app/actions/user.actions";
import { Card, StatusBadge } from "../../_components/ui";
import { UserForm } from "../_components/user-form";
import { UserRowActions } from "../_components/user-row-actions";

export default async function UsersPage({ params }: PageProps<"/[slug]/users">) {
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

  if (!ctx.permissions.includes("users.manage")) {
    redirect(`/${slug}/dashboard`);
  }

  const locale = await getRequestLocale();
  const t = getTranslator(locale);

  const tenantId = String(shop._id);
  const [users, roles] = await Promise.all([listShopUsers(tenantId), listRoles(tenantId)]);
  const roleNames = new Map(roles.map((role) => [role.key, role.name]));
  const roleOptions = roles.map((role) => ({ key: role.key, name: role.name }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("users.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("users.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${slug}/roles`}
            className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {t("roles.title")}
          </Link>
          <Link
            href={`/${slug}/settings`}
            className="inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {t("nav.settings")}
          </Link>
        </div>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("users.new")}
        </h2>
        <UserForm
          action={createShopUserAction}
          roles={roleOptions}
          submitLabel={t("users.create")}
          requirePassword
        />
      </Card>

      <Card className="overflow-x-auto p-0">
        <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
          {t("users.list")}
        </h2>
        {users.length === 0 ? (
          <p className="px-4 py-6 text-center text-zinc-500">{t("users.empty")}</p>
        ) : (
          <table className="w-full min-w-[820px] text-start text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                <th className="px-4 py-3 text-start font-medium">{t("forms.common.name")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("forms.common.email")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("users.fields.role")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("common.status")}</th>
                <th className="px-4 py-3 text-start font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const roleKey = user.roleKey || "owner";
                const isSelf = String(user._id) === ctx.session.userId;
                return (
                  <tr
                    key={String(user._id)}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/${slug}/users/${String(user._id)}`}
                        className="font-medium hover:underline"
                      >
                        {user.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-500" dir="ltr">
                      {user.email}
                    </td>
                    <td className="px-4 py-3">{roleNames.get(roleKey) ?? roleKey}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={user.isActive ? "active" : "inactive"} locale={locale} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/${slug}/users/${String(user._id)}`}
                          className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          {t("common.edit")}
                        </Link>
                        <UserRowActions
                          userId={String(user._id)}
                          active={Boolean(user.isActive)}
                          isSelf={isSelf}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
