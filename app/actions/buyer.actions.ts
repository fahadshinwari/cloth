"use server";

import { revalidatePath } from "next/cache";
import { requireMerchantAdmin } from "@/lib/auth";
import {
  BuyerServiceError,
  createBuyer,
  createLedgerEntry,
  createReminder,
  deleteLedgerEntry,
  deleteReminder,
  setReminderActive,
  updateBuyer,
} from "@/lib/services/buyer.service";
import {
  validateBuyerInput,
  validateLedgerEntryInput,
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
    ctx = await requireMerchantAdmin();
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
    ctx = await requireMerchantAdmin();
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
    ctx = await requireMerchantAdmin();
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateLedgerEntryInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await createLedgerEntry(ctx.tenantId, ctx.session.userId, parsed.data);
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

export async function deleteLedgerEntryAction(entryId: string): Promise<void> {
  const ctx = await requireMerchantAdmin();
  await deleteLedgerEntry(ctx.tenantId, entryId);
  revalidateBuyerPaths(ctx.tenantSlug);
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
    ctx = await requireMerchantAdmin();
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
  const ctx = await requireMerchantAdmin();
  await setReminderActive(ctx.tenantId, reminderId, active);
  revalidateBuyerPaths(ctx.tenantSlug);
}

export async function deleteReminderAction(reminderId: string): Promise<void> {
  const ctx = await requireMerchantAdmin();
  await deleteReminder(ctx.tenantId, reminderId);
  revalidateBuyerPaths(ctx.tenantSlug);
}
