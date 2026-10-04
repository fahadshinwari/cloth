"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import {
  TenantServiceError,
  createShop,
  resetShopCredentials,
  setShopStatus,
  updateShop,
} from "@/lib/services/tenant.service";
import { validateResetCredentials, validateShopInput } from "@/lib/validation";
import { getErrorMessage } from "@/lib/utils";

export interface ShopFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function createShopAction(
  _prev: ShopFormState,
  formData: FormData,
): Promise<ShopFormState> {
  try {
    await requireSuperAdmin();
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateShopInput(
    Object.fromEntries(formData.entries()),
    { requirePassword: true },
  );

  if (!parsed.success) {
    return { fieldErrors: parsed.errors };
  }

  try {
    await createShop(parsed.data);
  } catch (error) {
    if (error instanceof TenantServiceError) {
      return { error: error.message, fieldErrors: error.field ? { [error.field]: error.message } : undefined };
    }
    return { error: getErrorMessage(error) };
  }

  revalidatePath("/admin");
  return { ok: true };
}

export async function updateShopAction(
  shopId: string,
  _prev: ShopFormState,
  formData: FormData,
): Promise<ShopFormState> {
  try {
    await requireSuperAdmin();
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateShopInput(
    Object.fromEntries(formData.entries()),
    { requirePassword: false },
  );

  if (!parsed.success) {
    return { fieldErrors: parsed.errors };
  }

  try {
    await updateShop(shopId, parsed.data);
  } catch (error) {
    if (error instanceof TenantServiceError) {
      return { error: error.message, fieldErrors: error.field ? { [error.field]: error.message } : undefined };
    }
    return { error: getErrorMessage(error) };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/shops/${shopId}`);
  return { ok: true };
}

export async function toggleShopStatusAction(shopId: string): Promise<void> {
  const { session } = await requireSuperAdmin();
  void session;

  const { getShopById } = await import("@/lib/services/tenant.service");
  const shop = await getShopById(shopId);
  if (!shop) return;

  await setShopStatus(shopId, shop.status === "active" ? "inactive" : "active");
  revalidatePath("/admin");
}

/**
 * Super-admin-only: toggles the tenant-wide escape hatch that permits
 * inventory movements to drive a cloth's stock below zero (Module 4).
 */
export async function toggleNegativeInventoryAction(
  shopId: string,
  allow: boolean,
): Promise<void> {
  await requireSuperAdmin();

  const { ShopModel } = await import("@/lib/models");
  const { connectToDatabase } = await import("@/lib/mongodb");

  await connectToDatabase();
  await ShopModel.updateOne({ _id: shopId }, { $set: { allowNegativeInventory: allow } });
  revalidatePath("/admin");
  revalidatePath(`/admin/shops/${shopId}`);
}

/**
 * Super-admin-only: allows or forbids advance payments (payments exceeding
 * the counterparty's outstanding balance) for a tenant.
 */
export async function toggleAdvancePaymentsAction(
  shopId: string,
  allow: boolean,
): Promise<void> {
  await requireSuperAdmin();

  const { ShopModel } = await import("@/lib/models");
  const { connectToDatabase } = await import("@/lib/mongodb");

  await connectToDatabase();
  await ShopModel.updateOne({ _id: shopId }, { $set: { allowAdvancePayments: allow } });
  revalidatePath("/admin");
  revalidatePath(`/admin/shops/${shopId}`);
}

export interface ResetCredentialsState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function resetShopCredentialsAction(
  shopId: string,
  _prev: ResetCredentialsState,
  formData: FormData,
): Promise<ResetCredentialsState> {
  try {
    await requireSuperAdmin();
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateResetCredentials(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { fieldErrors: parsed.errors };
  }

  try {
    await resetShopCredentials(shopId, parsed.data);
  } catch (error) {
    if (error instanceof TenantServiceError) {
      return { error: error.message, fieldErrors: error.field ? { [error.field]: error.message } : undefined };
    }
    return { error: getErrorMessage(error) };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/shops/${shopId}`);
  return { ok: true };
}
