import Link from "next/link";
import { createPartnerAction } from "@/app/actions/partner.actions";
import { Card } from "../../../_components/ui";
import { EntityForm } from "../../_components/entity-form";

export default async function NewPartnerPage({
  params,
}: PageProps<"/[slug]/partners/new">) {
  const { slug } = await params;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/${slug}/partners`} className="text-sm text-zinc-500 hover:underline">
          ← Partners
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New partner</h1>
      </div>

      <Card>
        <EntityForm action={createPartnerAction} submitLabel="Create partner" onCancelHref={`/${slug}/partners`} />
      </Card>
    </div>
  );
}
