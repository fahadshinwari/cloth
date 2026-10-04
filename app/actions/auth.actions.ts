"use server";

import { redirect } from "next/navigation";
import { USER_ROLE } from "@/lib/constants";
import { createSessionCookie, destroySession, getSession } from "@/lib/session";
import { buildSessionPayload, verifyCredentials } from "@/lib/services/auth.service";
import { validateCredentials } from "@/lib/validation";
import { getErrorMessage } from "@/lib/utils";

export interface LoginActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = validateCredentials({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.errors };
  }

  let destination = "/";

  try {
    const user = await verifyCredentials(parsed.data);

    // Optional per-shop login: the form includes the shop slug. Verify the
    // merchant actually belongs to that shop (defense in depth — the session
    // remains the single source of truth for tenancy).
    const shopSlug = String(formData.get("shopSlug") ?? "").trim();
    if (shopSlug && user.role === USER_ROLE.MERCHANT_ADMIN) {
      const { getShopBySlug } = await import("@/lib/services/tenant.service");
      const shop = await getShopBySlug(shopSlug);
      if (!shop || String(shop._id) !== String(user.tenantId)) {
        return { error: "This account does not belong to this shop." };
      }
    }

    const payload = await buildSessionPayload(user);
    await createSessionCookie(payload);

    destination =
      user.role === USER_ROLE.SUPER_ADMIN
        ? "/admin"
        : `/${payload.tenantSlug}/dashboard`;
  } catch (error) {
    return { error: getErrorMessage(error) };
  }

  redirect(destination);
}

/**
 * Sign out. If the user was a merchant admin, returns them to /login;
 * super admins go to /super-login.
 */
export async function logoutAction(): Promise<void> {
  const session = await getSession();
  await destroySession();

  redirect(
    session?.role === USER_ROLE.SUPER_ADMIN ? "/super-login" : "/login",
  );
}
