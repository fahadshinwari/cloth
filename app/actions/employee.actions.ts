"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  EmployeeServiceError,
  createEmployee,
  deleteEmployee,
  updateEmployee,
} from "@/lib/services/employee.service";
import { validateEmployeeInput } from "@/lib/validation";
import { getErrorMessage } from "@/lib/utils";
import type { FormActionState } from "./partner.actions";

function revalidateEmployeePaths(slug: string): void {
  revalidatePath(`/${slug}/employees`);
  revalidatePath(`/${slug}/expenses`);
  // Employee names feed the "received by" dropdown on ledger entries.
  revalidatePath(`/${slug}/buyers`);
  revalidatePath(`/${slug}/suppliers`);
}

export async function createEmployeeAction(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("employees.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateEmployeeInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await createEmployee(ctx.tenantId, ctx.session.userId, parsed.data);
    revalidateEmployeePaths(ctx.tenantSlug);
    return { ok: true };
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function updateEmployeeAction(
  employeeId: string,
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("employees.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateEmployeeInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await updateEmployee(ctx.tenantId, employeeId, ctx.session.userId, parsed.data);
    revalidateEmployeePaths(ctx.tenantSlug);
    revalidatePath(`/${ctx.tenantSlug}/employees/${employeeId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof EmployeeServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function deleteEmployeeAction(employeeId: string): Promise<void> {
  const ctx = await requirePermission("employees.manage");
  await deleteEmployee(ctx.tenantId, employeeId);
  revalidateEmployeePaths(ctx.tenantSlug);
}
