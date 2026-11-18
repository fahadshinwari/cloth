import Link from "next/link";
import { createSupplierAction } from "@/app/actions/supplier.actions";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { Card } from "../../../_components/ui";
import { SupplierForm } from "../../_components/party-form";

export default async function NewSupplierPage({
  params,
}: PageProps<"/[slug]/suppliers/new">) {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const t = getTranslator(locale);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/${slug}/suppliers`} className="text-sm text-zinc-500 hover:underline">
          ← {t("suppliers.title")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("suppliers.new")}</h1>
      </div>

      <Card>
        <SupplierForm
          action={createSupplierAction}
          submitLabel={t("common.create")}
          onCancelHref={`/${slug}/suppliers`}
        />
      </Card>
    </div>
  );
}
