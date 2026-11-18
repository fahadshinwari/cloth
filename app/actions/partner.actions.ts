"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import {
  PartnerServiceError,
  createInvestment,
  createPartner,
  deleteInvestment,
  updatePartner,
} from "@/lib/services/partner.service";
import { validateInvestmentInput, validatePartnerInput } from "@/lib/validation";
import { getErrorMessage } from "@/lib/utils";
import type { PrintPayload } from "@/lib/print";

export interface FormActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Present after a successful ledger entry save — enables printing. */
  print?: PrintPayload;
}

export type PartnerFormAction = (
  state: FormActionState,
  formData: FormData,
) => Promise<FormActionState>;

function revalidatePartnerPaths(slug: string, partnerId?: string): void {
  revalidatePath(`/${slug}/dashboard`);
  revalidatePath(`/${slug}/partners`);
  if (partnerId) revalidatePath(`/${slug}/partners/${partnerId}`);
}

export async function createPartnerAction(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("partners.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validatePartnerInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    const partner = await createPartner(ctx.tenantId, ctx.session.userId, parsed.data);
    revalidatePartnerPaths(ctx.tenantSlug, String(partner._id));
    return { ok: true };
  } catch (error) {
    if (error instanceof PartnerServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function updatePartnerAction(
  partnerId: string,
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("partners.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validatePartnerInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await updatePartner(ctx.tenantId, partnerId, ctx.session.userId, parsed.data);
    revalidatePartnerPaths(ctx.tenantSlug, partnerId);
    return { ok: true };
  } catch (error) {
    if (error instanceof PartnerServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function createInvestmentAction(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let ctx;
  try {
    ctx = await requirePermission("partners.manage");
  } catch {
    return { error: "Unauthorized" };
  }

  const parsed = validateInvestmentInput(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { fieldErrors: parsed.errors };

  try {
    await createInvestment(ctx.tenantId, ctx.session.userId, parsed.data);
    revalidatePartnerPaths(ctx.tenantSlug, parsed.data.partnerId);
    return { ok: true };
  } catch (error) {
    if (error instanceof PartnerServiceError) {
      return {
        error: error.message,
        fieldErrors: error.field ? { [error.field]: error.message } : undefined,
      };
    }
    return { error: getErrorMessage(error) };
  }
}

export async function deleteInvestmentAction(investmentId: string): Promise<void> {
  const ctx = await requirePermission("partners.manage");
  await deleteInvestment(ctx.tenantId, investmentId);
  revalidatePartnerPaths(ctx.tenantSlug);
}
