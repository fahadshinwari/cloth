import "server-only";
import { PERMISSIONS, USER_ROLE, type Permission } from "./constants";
import { RoleModel, UserModel, ShopModel, type UserDocument } from "./models";
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
  /** Shop role key ("owner" for legacy shop admins). */
  roleKey: string;
  /** Permissions granted by the user's live role record. */
  permissions: Permission[];
}

/** True when the context includes the given permission. */
export function hasPermission(ctx: AuthContext, permission: Permission): boolean {
  return ctx.permissions.includes(permission);
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

  if (user.role === USER_ROLE.SUPER_ADMIN) {
    return { session, user, roleKey: "super_admin", permissions: [...PERMISSIONS] };
  }

  // Roles are read live so a permission change takes effect immediately.
  const roleKey = user.roleKey || "owner";
  const role = user.tenantId
    ? await RoleModel.findOne({ tenantId: user.tenantId, key: roleKey }).lean()
    : null;

  const permissions =
    role?.permissions && Array.isArray(role.permissions)
      ? (role.permissions.filter((value) =>
          (PERMISSIONS as readonly string[]).includes(value),
        ) as Permission[])
      : roleKey === "owner"
        ? [...PERMISSIONS]
        : [];

  return { session, user, roleKey, permissions };
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
 * Guard for a specific shop permission. Always resolves the tenant from the
 * session first, then checks the live role's permission list.
 */
export async function requirePermission(
  permission: Permission,
): Promise<AuthContext & { tenantId: string; tenantSlug: string }> {
  const ctx = await requireMerchantAdmin();
  if (!ctx.permissions.includes(permission)) {
    throw new AuthError("You do not have permission to perform this action.");
  }
  return ctx;
}

/**
 * Guard for code accessible to any authenticated user.
 */
export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new AuthError("Not authenticated");
  return ctx;
}
