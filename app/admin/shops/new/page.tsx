import Link from "next/link";
import { createShopAction } from "@/app/actions/tenant.actions";
import { Card } from "../../../_components/ui";
import { ShopForm } from "../../_components/shop-form";

export default function NewShopPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
          ← Shops
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">New shop</h1>
      </div>

      <Card>
        <ShopForm action={createShopAction} submitLabel="Create shop" />
      </Card>
    </div>
  );
}
