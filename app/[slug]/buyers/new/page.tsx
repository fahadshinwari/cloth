import Link from "next/link";
import { createBuyerAction } from "@/app/actions/buyer.actions";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { Card } from "../../../_components/ui";
import { EntityForm } from "../../_components/entity-form";

export default async function NewBuyerPage({
  params,
}: PageProps<"/[slug]/buyers/new">) {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const t = getTranslator(locale);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/${slug}/buyers`} className="text-sm text-zinc-500 hover:underline">
          ← {t("buyers.title")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("buyers.new")}</h1>
      </div>

      <Card>
        <EntityForm
          action={createBuyerAction}
          withShopName
          submitLabel={t("common.create")}
          onCancelHref={`/${slug}/buyers`}
        />
      </Card>
    </div>
  );
}
