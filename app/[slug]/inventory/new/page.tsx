import Link from "next/link";
import { createClothAction } from "@/app/actions/inventory.actions";
import { listSuppliers } from "@/lib/services/supplier.service";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { Card } from "../../../_components/ui";
import { ClothForm } from "../../_components/cloth-form";

export default async function NewClothPage({
  params,
}: PageProps<"/[slug]/inventory/new">) {
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

  const suppliers = await listSuppliers(String(shop._id));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/${slug}/inventory`} className="text-sm text-zinc-500 hover:underline">
          ← Inventory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New cloth</h1>
      </div>

      <Card>
        <ClothForm
          action={createClothAction}
          suppliers={suppliers.map((supplier) => ({
            id: String(supplier._id),
            name: supplier.name,
            companyName: supplier.companyName,
          }))}
          submitLabel="Create cloth"
          onCancelHref={`/${slug}/inventory`}
        />
      </Card>
    </div>
  );
}
