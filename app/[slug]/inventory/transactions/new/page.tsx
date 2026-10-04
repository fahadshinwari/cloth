import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { listCloths } from "@/lib/services/inventory.service";
import { listBuyers } from "@/lib/services/buyer.service";
import { listSuppliers } from "@/lib/services/supplier.service";
import { Card } from "../../../../_components/ui";
import { InventoryTransactionForm } from "../../../_components/inventory-transaction-form";

export default async function NewInventoryTransactionPage({
  params,
}: PageProps<"/[slug]/inventory/transactions/new">) {
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

  const tenantId = String(shop._id);
  const [cloths, buyers, suppliers] = await Promise.all([
    listCloths(tenantId),
    listBuyers(tenantId),
    listSuppliers(tenantId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/${slug}/inventory`} className="text-sm text-zinc-500 hover:underline">
          ← Inventory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New inventory transaction</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Stock changes only through transactions — purchases raise supplier payables and sales
          raise buyer balances when on credit.
        </p>
      </div>

      <Card>
        <InventoryTransactionForm
          cloths={cloths.map((cloth) => ({
            id: String(cloth._id),
            name: cloth.name,
            currency: cloth.currency,
            pricePerMeter: String(cloth.pricePerMeterMinor / 100),
          }))}
          suppliers={suppliers.map((supplier) => ({
            id: String(supplier._id),
            name: supplier.name,
            companyName: supplier.companyName,
          }))}
          buyers={buyers.map((buyer) => ({
            id: String(buyer._id),
            name: buyer.name,
            shopName: buyer.shopName,
          }))}
          submitLabel="Record transaction"
        />
      </Card>
    </div>
  );
}
