import "server-only";
import bcrypt from "bcryptjs";
import { USER_ROLE } from "../constants";
import { UserModel, type UserDocument } from "../models";
import { AuthError } from "../auth";
import type { CredentialsInput } from "../validation";

/**
 * Verifies credentials and returns the hydrated user.
 * Works for both super admins and merchant admins.
 */
export async function verifyCredentials({ email, password }: CredentialsInput): Promise<UserDocument> {
  await connect();

  const user = await UserModel.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user || !user.isActive) {
    throw new AuthError("Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AuthError("Invalid email or password");
  }

  return user;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function buildSessionPayload(user: UserDocument) {
  let tenantSlug: string | null = null;

  if (user.role === USER_ROLE.MERCHANT_ADMIN && user.tenantId) {
    const { ShopModel } = await import("../models");
    const shop = await ShopModel.findById(user.tenantId).select("slug status");
    if (!shop || shop.status !== "active") {
      throw new AuthError("This shop is inactive. Contact the platform administrator.");
    }
    tenantSlug = shop.slug;
  }

  return {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    tenantId: user.tenantId ? user.tenantId.toString() : null,
    tenantSlug,
  } as const;
}

async function connect() {
  const { connectToDatabase } = await import("../mongodb");
  await connectToDatabase();
}
