"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  BuyerServiceError,
  createBuyer,
  createLedgerEntry,
  createReminder,
  deleteLedgerEntry,
  deleteReminder,
  getBuyerById,
  setReminderActive,
  updateBuyer,
  updateLedgerEntry,
} from "@/lib/services/buyer.service";
import { getShopById } from "@/lib/services/tenant.service";
import {
  validateAuditReason,
  validateBuyerInput,
  validateLedgerEntryInput,
  validateLedgerEntryUpdateInput,
  validatePaymentReminderInput,
} from "@/lib/validation";
import { getErrorMessage } from "@/lib/utils";
import type { FormActionState } from "./partner.actions";

export type { FormActionState };

function revalidateBuyerPaths(slug: string, buyerId?: string): void {
  revalidatePath(`/${slug}/dashboard`);
  revalidatePath(`/${slug}/buyers`);
  revalidatePath(`/${slug}/reminders`);
  if (buyerId) revalidatePath(`/${slug}/buyers/${buyerId}`);
}

export async function createBuyerAction(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("buyers.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateBuyerInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    const buyer = await createBuyer(ctx.tenantId, ctx.session.userId, parsed.data);
    revalidateBuyerPaths(ctx.tenantSlug, String(buyer._id));
    return { ok: true };
  } catch (error) {
    if (error instanceof BuyerServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function updateBuyerAction(
  buyerId: string,
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("buyers.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateBuyerInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await updateBuyer(ctx.tenantId, buyerId, ctx.session.userId, parsed.data);
    revalidateBuyerPaths(ctx.tenantSlug, buyerId);
    return { ok: true };
  } catch (error) {
    if (error instanceof BuyerServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function createLedgerEntryAction(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("buyers.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateLedgerEntryInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    const entry = await createLedgerEntry(ctx.tenantId, ctx.session.userId, parsed.data);
    revalidateBuyerPaths(ctx.tenantSlug, parsed.data.buyerId);

    const [buyer, shop] = await Promise.all([
      getBuyerById(ctx.tenantId, parsed.data.buyerId),
      getShopById(ctx.tenantId),
    ]);

    return {
      ok: true,
      print: {
        kind: "buyer",
        shopName: shop?.name ?? "",
        partyName: buyer?.name ?? "",
        partyCode: buyer?.code ?? "",
        type: entry.type,
        amountMinor: entry.amountMinor,
        currency: entry.currency as "AFN" | "USD",
        date: entry.occurredAt.toISOString(),
        billNo: entry.billNo ?? "",
        receivedBy: entry.receivedBy ?? "",
        note: entry.note ?? "",
      },
    };
  } catch (error) {
    if (error instanceof BuyerServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function updateLedgerEntryAction(
  entryId: string,
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("ledger.edit");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateLedgerEntryUpdateInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    const entry = await updateLedgerEntry(ctx.tenantId, ctx.session.userId, entryId, parsed.data);
    revalidateBuyerPaths(ctx.tenantSlug, String(entry.buyerId));
    return { ok: true };
  } catch (error) {
    if (error instanceof BuyerServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function deleteLedgerEntryAction(
  entryId: string,
  reason: string,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("ledger.delete");
  } catch {
    return { error: "Unauthorized" };
  }

  const cleanReason = validateAuditReason(reason);
  if (!cleanReason) {
    return {
      error: "A reason of 3–500 characters is required.",
      fieldErrors: { reason: "A reason of 3–500 characters is required." },
    };
  }

  try {
    await deleteLedgerEntry(ctx.tenantId, ctx.session.userId, entryId, cleanReason);
    revalidateBuyerPaths(ctx.tenantSlug);
    return { ok: true };
  } catch (error) {
    if (error instanceof BuyerServiceError) return { error: error.message };
    return { error: getErrorMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Payment reminders — informational only; never affect ledger balances
// ---------------------------------------------------------------------------

export async function createReminderAction(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("reminders.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validatePaymentReminderInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await createReminder(ctx.tenantId, parsed.data);
    revalidateBuyerPaths(ctx.tenantSlug, parsed.data.buyerId);
    return { ok: true };
  } catch (error) {
    if (error instanceof BuyerServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function toggleReminderAction(reminderId: string, active: boolean): Promise<void> {
  const ctx = await requirePermission("reminders.manage");
  await setReminderActive(ctx.tenantId, reminderId, active);
  revalidateBuyerPaths(ctx.tenantSlug);
}

export async function deleteReminderAction(reminderId: string): Promise<void> {
  const ctx = await requirePermission("reminders.manage");
  await deleteReminder(ctx.tenantId, reminderId);
  revalidateBuyerPaths(ctx.tenantSlug);
}
