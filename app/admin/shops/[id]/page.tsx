import Link from "next/link";
import { notFound } from "next/navigation";
import { getShopById } from "@/lib/services/tenant.service";
import { resetShopCredentialsAction, updateShopAction } from "@/app/actions/tenant.actions";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { Card } from "../../../_components/ui";
import { ShopForm } from "../../_components/shop-form";
import { ResetCredentialsForm } from "../[id]/_components/reset-credentials-form";
import { InventorySettingsForm } from "../[id]/_components/inventory-settings-form";

export default async function EditShopPage({ params }: PageProps<"/admin/shops/[id]">) {
  const { id } = await params;
  const shop = await getShopById(id);
  if (!shop) notFound();

  const locale = await getRequestLocale();
  const t = getTranslator(locale);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
          ← {t("nav.shops")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{shop.name}</h1>
        <p className="text-sm text-zinc-500">/{shop.slug}</p>
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("settings.shopInfo")}
        </h2>
        <ShopForm
          action={updateShopAction.bind(null, String(shop._id))}
          values={{
            name: shop.name,
            slug: shop.slug,
            adminName: shop.adminName,
            adminEmail: shop.adminEmail,
            phone: shop.phone,
            currency: shop.currency,
            status: shop.status,
          }}
          submitLabel={t("admin.actions.saveChanges")}
          editing
        />
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("admin.actions.resetTitle")}
        </h2>
        <ResetCredentialsForm
          action={resetShopCredentialsAction.bind(null, String(shop._id))}
        />
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          {t("admin.settings.title")}
        </h2>
        <InventorySettingsForm
          shopId={String(shop._id)}
          allowNegativeInventory={shop.allowNegativeInventory ?? false}
          allowAdvancePayments={shop.allowAdvancePayments ?? false}
        />
      </Card>
    </div>
  );
}
