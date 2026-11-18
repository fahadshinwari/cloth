import { notFound, redirect } from "next/navigation";
import { PERMISSIONS, PERMISSION_LABEL_KEYS, USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { listRoles } from "@/lib/services/role.service";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { createRoleAction, updateRoleAction } from "@/app/actions/user.actions";
import { Card } from "../../_components/ui";
import { RoleForm } from "../_components/role-form";
import { RoleDeleteButton } from "../_components/role-delete-button";

export default async function RolesPage({ params }: PageProps<"/[slug]/roles">) {
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

  if (!ctx.permissions.includes("roles.manage")) {
    redirect(`/${slug}/dashboard`);
  }

  const locale = await getRequestLocale();
  const t = getTranslator(locale);

  const roles = await listRoles(String(shop._id));
  const permissionOptions = PERMISSIONS.map((permission) => ({
    value: permission,
    label: t(PERMISSION_LABEL_KEYS[permission]),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("roles.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t("roles.subtitle")}</p>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("roles.create")}
        </h2>
        <RoleForm
          action={createRoleAction}
          permissions={permissionOptions}
          submitLabel={t("common.create")}
        />
      </Card>

      <div className="flex flex-col gap-4">
        {roles.length === 0 ? (
          <Card>
            <p className="text-center text-zinc-500">{t("roles.empty")}</p>
          </Card>
        ) : (
          roles.map((role) => {
            const isOwner = role.key === "owner";
            return (
              <Card key={String(role._id)}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold">{role.name}</h2>
                    <p className="text-xs text-zinc-500" dir="ltr">
                      {role.key}
                    </p>
                  </div>
                  {!role.isSystem && !isOwner ? (
                    <RoleDeleteButton roleId={String(role._id)} />
                  ) : null}
                </div>
                <RoleForm
                  action={updateRoleAction.bind(null, String(role._id))}
                  permissions={permissionOptions}
                  values={{
                    name: role.name,
                    key: role.key,
                    permissions: role.permissions ?? [],
                  }}
                  submitLabel={t("common.save")}
                  lockPermissions={isOwner}
                />
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
