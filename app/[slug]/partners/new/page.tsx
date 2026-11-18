import Link from "next/link";
import { createPartnerAction } from "@/app/actions/partner.actions";
import { getTranslator } from "@/lib/i18n/dictionaries";
import { getRequestLocale } from "@/lib/i18n/request";
import { Card } from "../../../_components/ui";
import { EntityForm } from "../../_components/entity-form";

export default async function NewPartnerPage({
  params,
}: PageProps<"/[slug]/partners/new">) {
  const { slug } = await params;
  const locale = await getRequestLocale();
  const t = getTranslator(locale);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/${slug}/partners`} className="text-sm text-zinc-500 hover:underline">
          ← {t("partners.title")}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("partners.new")}</h1>
      </div>

      <Card>
        <EntityForm
          action={createPartnerAction}
          submitLabel={t("common.create")}
          onCancelHref={`/${slug}/partners`}
        />
      </Card>
    </div>
  );
}
