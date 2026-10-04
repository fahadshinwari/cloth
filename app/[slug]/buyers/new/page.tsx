import Link from "next/link";
import { createBuyerAction } from "@/app/actions/buyer.actions";
import { Card } from "../../../_components/ui";
import { EntityForm } from "../../_components/entity-form";

export default async function NewBuyerPage({
  params,
}: PageProps<"/[slug]/buyers/new">) {
  const { slug } = await params;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/${slug}/buyers`} className="text-sm text-zinc-500 hover:underline">
          ← Buyers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New buyer</h1>
      </div>

      <Card>
        <EntityForm
          action={createBuyerAction}
          withShopName
          submitLabel="Create buyer"
          onCancelHref={`/${slug}/buyers`}
        />
      </Card>
    </div>
  );
}
