"use server";

import { revalidatePath } from "next/cache";
import { requireMerchantAdmin } from "@/lib/auth";
import {
  SupplierServiceError,
  createSupplier,
  createSupplierLedgerEntry,
  deleteSupplierLedgerEntry,
  updateSupplier,
} from "@/lib/services/supplier.service";
import { validateSupplierInput, validateSupplierLedgerEntryInput } from "@/lib/validation";
import { getErrorMessage } from "@/lib/utils";
import type { FormActionState } from "./partner.actions";

function revalidateSupplierPaths(slug: string, supplierId?: string): void {
  revalidatePath(`/${slug}/dashboard`);
  revalidatePath(`/${slug}/suppliers`);
  if (supplierId) revalidatePath(`/${slug}/suppliers/${supplierId}`);
}

export async function createSupplierAction(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requireMerchantAdmin();
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateSupplierInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    const supplier = await createSupplier(ctx.tenantId, ctx.session.userId, parsed.data);
    revalidateSupplierPaths(ctx.tenantSlug, String(supplier._id));
    return { ok: true };
  } catch (error) {
    if (error instanceof SupplierServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function updateSupplierAction(
  supplierId: string,
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requireMerchantAdmin();
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateSupplierInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await updateSupplier(ctx.tenantId, supplierId, ctx.session.userId, parsed.data);
    revalidateSupplierPaths(ctx.tenantSlug, supplierId);
    return { ok: true };
  } catch (error) {
    if (error instanceof SupplierServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function createSupplierLedgerEntryAction(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requireMerchantAdmin();
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateSupplierLedgerEntryInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await createSupplierLedgerEntry(ctx.tenantId, ctx.session.userId, parsed.data);
    revalidateSupplierPaths(ctx.tenantSlug, parsed.data.supplierId);
    return { ok: true };
  } catch (error) {
    if (error instanceof SupplierServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function deleteSupplierLedgerEntryAction(entryId: string): Promise<void> {
  const ctx = await requireMerchantAdmin();
  await deleteSupplierLedgerEntry(ctx.tenantId, entryId);
  revalidateSupplierPaths(ctx.tenantSlug);
}
