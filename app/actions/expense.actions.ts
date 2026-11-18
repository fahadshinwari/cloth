"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  ExpenseServiceError,
  createExpense,
  deleteExpense,
  updateExpense,
} from "@/lib/services/expense.service";
import { validateExpenseInput } from "@/lib/validation";
import { getErrorMessage } from "@/lib/utils";
import type { FormActionState } from "./partner.actions";

function revalidateExpensePaths(slug: string): void {
  revalidatePath(`/${slug}/expenses`);
  revalidatePath(`/${slug}/dashboard`);
}

export async function createExpenseAction(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("expenses.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateExpenseInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await createExpense(ctx.tenantId, ctx.session.userId, parsed.data);
    revalidateExpensePaths(ctx.tenantSlug);
    return { ok: true };
  } catch (error) {
    if (error instanceof ExpenseServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function updateExpenseAction(
  expenseId: string,
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("expenses.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateExpenseInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await updateExpense(ctx.tenantId, expenseId, ctx.session.userId, parsed.data);
    revalidateExpensePaths(ctx.tenantSlug);
    revalidatePath(`/${ctx.tenantSlug}/expenses/${expenseId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof ExpenseServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function deleteExpenseAction(expenseId: string): Promise<void> {
  const ctx = await requirePermission("expenses.manage");
  await deleteExpense(ctx.tenantId, expenseId);
  revalidateExpensePaths(ctx.tenantSlug);
}
