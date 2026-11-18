import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { getShopUserById } from "@/lib/services/user.service";
import { listRoles } from "@/lib/services/role.service";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { updateShopUserAction } from "@/app/actions/user.actions";
import { Card } from "../../../_components/ui";
import { UserForm } from "../../_components/user-form";

export default async function EditUserPage({ params }: PageProps<"/[slug]/users/[id]">) {
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

  if (!ctx.permissions.includes("users.manage")) {
    redirect(`/${slug}/dashboard`);
  }

  const locale = await getRequestLocale();
  const t = getTranslator(locale);

  const tenantId = String(shop._id);
  const [user, roles] = await Promise.all([getShopUserById(tenantId, id), listRoles(tenantId)]);
  if (!user) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/${slug}/users`} className="text-sm text-zinc-500 hover:underline">
          ← {t("users.title")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("users.edit")}</h1>
      </div>

      <Card>
        <UserForm
          action={updateShopUserAction.bind(null, String(user._id))}
          roles={roles.map((role) => ({ key: role.key, name: role.name }))}
          values={{
            name: user.name,
            email: user.email,
            roleKey: user.roleKey || "owner",
            isActive: Boolean(user.isActive),
          }}
          submitLabel={t("common.save")}
          requirePassword={false}
          onCancelHref={`/${slug}/users`}
        />
      </Card>
    </div>
  );
}
