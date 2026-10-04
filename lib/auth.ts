import "server-only";
import { USER_ROLE } from "./constants";
import { UserModel, ShopModel, type UserDocument } from "./models";
import type { SessionPayload } from "./session";

/**
 * Thrown when authentication or authorization fails.
 */
export class AuthError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthError";
  }
}

export interface AuthContext {
  session: SessionPayload;
  /** Resolved live user record from the database. */
  user: UserDocument;
}

/**
 * Returns the current session or null. Lightweight helper for layouts
 * that only need to know *whether* a user is signed in.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const { getSession } = await import("./session");
  const session = await getSession();
  if (!session) return null;

  const user = await UserModel.findById(session.userId);
  if (!user || !user.isActive) return null;

  // Super admin deactivating a shop must immediately lock out its admin.
  if (user.role === USER_ROLE.MERCHANT_ADMIN) {
    if (!user.tenantId) return null;
    const shop = await ShopModel.findById(user.tenantId);
    if (!shop || shop.status !== "active") return null;
  }

  return { session, user };
}

/**
 * Guard for super-admin-only server code (pages, actions, route handlers).
 */
export async function requireSuperAdmin(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new AuthError("Not authenticated");
  if (ctx.session.role !== USER_ROLE.SUPER_ADMIN) throw new AuthError("Super admin only");
  return ctx;
}

/**
 * Guard for merchant-admin-only server code. The tenant is taken from the
 * session token — NEVER from any client-supplied value.
 */
export async function requireMerchantAdmin(): Promise<AuthContext & { tenantId: string; tenantSlug: string }> {
  const ctx = await getAuthContext();
  if (!ctx) throw new AuthError("Not authenticated");
  if (ctx.session.role !== USER_ROLE.MERCHANT_ADMIN) throw new AuthError("Merchant admin only");

  const tenantId = ctx.session.tenantId;
  const tenantSlug = ctx.session.tenantSlug;
  if (!tenantId || !tenantSlug) throw new AuthError("No tenant bound to this session");

  return { ...ctx, tenantId, tenantSlug };
}

/**
 * Guard for code accessible to any authenticated user.
 */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new AuthError("Not authenticated");
  return ctx;
}
