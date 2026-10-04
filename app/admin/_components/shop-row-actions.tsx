"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toggleShopStatusAction } from "@/app/actions/tenant.actions";

export function ShopRowActions({
  shopId,
  status,
}: {
  shopId: string;
  status: "active" | "inactive";
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2" dir="ltr">
      <Link
        href={`/admin/shops/${shopId}`}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Edit
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void toggleShopStatusAction(shopId))}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {pending ? "…" : status === "active" ? "Deactivate" : "Activate"}
      </button>
    </div>
  );
}
