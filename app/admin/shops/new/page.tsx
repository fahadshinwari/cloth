import Link from "next/link";
import { createShopAction } from "@/app/actions/tenant.actions";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { Card } from "../../../_components/ui";
import { ShopForm } from "../../_components/shop-form";

export default async function NewShopPage() {
  const locale = await getRequestLocale();
  const t = getTranslator(locale);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
          ← {t("nav.shops")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("admin.newShop")}</h1>
      </div>

      <Card>
        <ShopForm action={createShopAction} submitLabel={t("admin.actions.createShop")} />
      </Card>
    </div>
  );
}
