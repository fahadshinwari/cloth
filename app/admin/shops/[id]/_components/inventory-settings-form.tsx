"use client";

import { useTransition } from "react";
import {
  toggleAdvancePaymentsAction,
  toggleNegativeInventoryAction,
} from "@/app/actions/tenant.actions";

export function InventorySettingsForm({
  shopId,
  allowNegativeInventory,
  allowAdvancePayments,
}: {
  shopId: string;
  allowNegativeInventory: boolean;
  allowAdvancePayments: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const buttonClass =
    "inline-flex h-10 shrink-0 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Allow negative inventory</p>
          <p className="mt-1 text-xs text-zinc-500">
            When off, sales that would push a cloth&apos;s stock below zero are rejected. Stock
            corrections should be recorded as ADJUSTMENT transactions instead.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => void toggleNegativeInventoryAction(shopId, !allowNegativeInventory))
          }
          className={buttonClass}
          dir="ltr"
        >
          {pending ? "…" : allowNegativeInventory ? "Allowed — turn off" : "Not allowed — turn on"}
        </button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Allow advance payments</p>
          <p className="mt-1 text-xs text-zinc-500">
            When off, payments exceeding the counterparty&apos;s outstanding balance are rejected.
            Turn on only if this merchant deliberately records advance/over payments.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => void toggleAdvancePaymentsAction(shopId, !allowAdvancePayments))
          }
          className={buttonClass}
          dir="ltr"
        >
          {pending ? "…" : allowAdvancePayments ? "Allowed — turn off" : "Not allowed — turn on"}
        </button>
      </div>
    </div>
  );
}
