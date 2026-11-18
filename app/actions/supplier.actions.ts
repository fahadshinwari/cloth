"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  SupplierServiceError,
  createSupplier,
  createSupplierLedgerEntry,
  deleteSupplierLedgerEntry,
  getSupplierById,
  updateSupplier,
  updateSupplierLedgerEntry,
} from "@/lib/services/supplier.service";
import { getShopById } from "@/lib/services/tenant.service";
import {
  validateAuditReason,
  validateSupplierInput,
  validateSupplierLedgerEntryInput,
  validateSupplierLedgerEntryUpdateInput,
} from "@/lib/validation";
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
    ctx = await requirePermission("suppliers.manage");
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
    ctx = await requirePermission("suppliers.manage");
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
    ctx = await requirePermission("suppliers.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateSupplierLedgerEntryInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    const entry = await createSupplierLedgerEntry(ctx.tenantId, ctx.session.userId, parsed.data);
    revalidateSupplierPaths(ctx.tenantSlug, parsed.data.supplierId);

    const [supplier, shop] = await Promise.all([
      getSupplierById(ctx.tenantId, parsed.data.supplierId),
      getShopById(ctx.tenantId),
    ]);

    return {
      ok: true,
      print: {
        kind: "supplier",
        shopName: shop?.name ?? "",
        partyName: supplier?.name ?? "",
        partyCode: supplier?.code ?? "",
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
    if (error instanceof SupplierServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function updateSupplierLedgerEntryAction(
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

  const parsed = validateSupplierLedgerEntryUpdateInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    const entry = await updateSupplierLedgerEntry(
      ctx.tenantId,
      ctx.session.userId,
      entryId,
      parsed.data,
    );
    revalidateSupplierPaths(ctx.tenantSlug, String(entry.supplierId));
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

export async function deleteSupplierLedgerEntryAction(
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
    await deleteSupplierLedgerEntry(ctx.tenantId, ctx.session.userId, entryId, cleanReason);
    revalidateSupplierPaths(ctx.tenantSlug);
    return { ok: true };
  } catch (error) {
    if (error instanceof SupplierServiceError) return { error: error.message };
    return { error: getErrorMessage(error) };
  }
}
