"use server";

import { revalidatePath } from "next/cache";
import { requireMerchantAdmin } from "@/lib/auth";
import {
  InventoryServiceError,
  createCloth,
  recordInventoryTransaction,
  updateCloth,
} from "@/lib/services/inventory.service";
import { validateClothInput, validateInventoryTransactionInput } from "@/lib/validation";
import { getErrorMessage } from "@/lib/utils";
import type { FormActionState } from "./partner.actions";

function revalidateInventoryPaths(slug: string, clothId?: string): void {
  revalidatePath(`/${slug}/dashboard`);
  revalidatePath(`/${slug}/inventory`);
  revalidatePath(`/${slug}/buyers`);
  revalidatePath(`/${slug}/suppliers`);
  if (clothId) revalidatePath(`/${slug}/inventory/${clothId}`);
}

export async function createClothAction(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requireMerchantAdmin();
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateClothInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    const cloth = await createCloth(ctx.tenantId, ctx.session.userId, parsed.data);
    revalidateInventoryPaths(ctx.tenantSlug, String(cloth._id));
    return { ok: true };
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function updateClothAction(
  clothId: string,
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requireMerchantAdmin();
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateClothInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await updateCloth(ctx.tenantId, clothId, ctx.session.userId, parsed.data);
    revalidateInventoryPaths(ctx.tenantSlug, clothId);
    return { ok: true };
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

/**
 * Records a purchase (from a supplier), a sale (to a buyer), or an
 * adjustment. This is the ONLY way stock changes — there is no direct
 * quantity edit. Credit portions flow into the buyer/supplier ledgers.
 */
export async function recordInventoryTransactionAction(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requireMerchantAdmin();
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateInventoryTransactionInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await recordInventoryTransaction(ctx.tenantId, ctx.session.userId, parsed.data);
    revalidateInventoryPaths(ctx.tenantSlug, parsed.data.clothId);
    if (parsed.data.buyerId) revalidatePath(`/${ctx.tenantSlug}/buyers/${parsed.data.buyerId}`);
    if (parsed.data.supplierId) revalidatePath(`/${ctx.tenantSlug}/suppliers/${parsed.data.supplierId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}
