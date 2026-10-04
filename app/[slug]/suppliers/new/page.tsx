import Link from "next/link";
import { createSupplierAction } from "@/app/actions/supplier.actions";
import { Card } from "../../../_components/ui";
import { SupplierForm } from "../../_components/party-form";

export default async function NewSupplierPage({
  params,
}: PageProps<"/[slug]/suppliers/new">) {
  const { slug } = await params;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/${slug}/suppliers`} className="text-sm text-zinc-500 hover:underline">
          ← Suppliers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New supplier</h1>
      </div>

      <Card>
        <SupplierForm
          action={createSupplierAction}
          submitLabel="Create supplier"
          onCancelHref={`/${slug}/suppliers`}
        />
      </Card>
    </div>
  );
}
