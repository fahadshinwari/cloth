"use server";

import { revalidatePath } from "next/cache";
import { requireMerchantAdmin } from "@/lib/auth";
import {
  TellerServiceError,
  createTellerTransaction,
} from "@/lib/services/teller.service";
import { validateTellerTransactionInput } from "@/lib/validation";
import { getErrorMessage } from "@/lib/utils";
import type { FormActionState } from "./partner.actions";

export async function createTellerTransactionAction(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requireMerchantAdmin();
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateTellerTransactionInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await createTellerTransaction(ctx.tenantId, ctx.session.userId, parsed.data);
    revalidatePath(`/${ctx.tenantSlug}/dashboard`);
    revalidatePath(`/${ctx.tenantSlug}/teller`);
    return { ok: true };
  } catch (error) {
    if (error instanceof TellerServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}
