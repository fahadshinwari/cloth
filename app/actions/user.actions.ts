"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  RoleServiceError,
  createRole,
  deleteRole,
  updateRole,
} from "@/lib/services/role.service";
import {
  UserServiceError,
  createShopUser,
  deleteShopUser,
  setShopUserActive,
  updateShopUser,
} from "@/lib/services/user.service";
import { validateRoleInput, validateShopUserInput } from "@/lib/validation";
import { getErrorMessage } from "@/lib/utils";
import type { FormActionState } from "./partner.actions";

function revalidateAccessPaths(slug: string): void {
  revalidatePath(`/${slug}/users`);
  revalidatePath(`/${slug}/roles`);
  revalidatePath(`/${slug}/settings`);
}

export async function createShopUserAction(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("users.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateShopUserInput(Object.fromEntries(formData.entries()), {
    requirePassword: true,
  });
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await createShopUser(ctx.tenantId, ctx.session.userId, parsed.data);
    revalidateAccessPaths(ctx.tenantSlug);
    return { ok: true };
  } catch (error) {
    if (error instanceof UserServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function updateShopUserAction(
  userId: string,
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("users.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateShopUserInput(Object.fromEntries(formData.entries()), {
    requirePassword: false,
  });
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await updateShopUser(ctx.tenantId, userId, ctx.session.userId, parsed.data);
    revalidateAccessPaths(ctx.tenantSlug);
    revalidatePath(`/${ctx.tenantSlug}/users/${userId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof UserServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function deleteShopUserAction(userId: string): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("users.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  try {
    await deleteShopUser(ctx.tenantId, userId, ctx.session.userId);
    revalidateAccessPaths(ctx.tenantSlug);
    return { ok: true };
  } catch (error) {
    if (error instanceof UserServiceError) return { error: error.message };
    return { error: getErrorMessage(error) };
  }
}

export async function setShopUserActiveAction(
  userId: string,
  active: boolean,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("users.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  try {
    await setShopUserActive(ctx.tenantId, userId, ctx.session.userId, active);
    revalidateAccessPaths(ctx.tenantSlug);
    return { ok: true };
  } catch (error) {
    if (error instanceof UserServiceError) return { error: error.message };
    return { error: getErrorMessage(error) };
  }
}

export async function createRoleAction(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("roles.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateRoleInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await createRole(ctx.tenantId, ctx.session.userId, parsed.data);
    revalidateAccessPaths(ctx.tenantSlug);
    return { ok: true };
  } catch (error) {
    if (error instanceof RoleServiceError) return { error: error.message };
    return { error: getErrorMessage(error) };
  }
}

export async function updateRoleAction(
  roleId: string,
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("roles.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateRoleInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await updateRole(ctx.tenantId, roleId, ctx.session.userId, parsed.data);
    revalidateAccessPaths(ctx.tenantSlug);
    return { ok: true };
  } catch (error) {
    if (error instanceof RoleServiceError) return { error: error.message };
    return { error: getErrorMessage(error) };
  }
}

export async function deleteRoleAction(roleId: string): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("roles.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  try {
    await deleteRole(ctx.tenantId, roleId);
    revalidateAccessPaths(ctx.tenantSlug);
    return { ok: true };
  } catch (error) {
    if (error instanceof RoleServiceError) return { error: error.message };
    return { error: getErrorMessage(error) };
  }
}
