import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { USER_ROLE } from "./constants";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "./constants";

const secretKey = process.env.AUTH_SECRET;

if (!secretKey) {
  throw new Error("Please define the AUTH_SECRET environment variable");
}

const encodedKey = new TextEncoder().encode(secretKey);

export interface SessionPayload {
  userId: string;
  email: string;
  role: (typeof USER_ROLE)[keyof typeof USER_ROLE];
  /** Only set for merchant_admin — the authoritative tenant of the request. */
  tenantId: string | null;
  /** Slug of the tenant, denormalized for quick redirects. */
  tenantSlug: string | null;
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(encodedKey);
}

export async function decryptSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });

    const userId = typeof payload.userId === "string" ? payload.userId : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    const role = payload.role === USER_ROLE.SUPER_ADMIN || payload.role === USER_ROLE.MERCHANT_ADMIN
      ? payload.role
      : null;

    if (!userId || !email || !role) return null;

    const tenantId = typeof payload.tenantId === "string" ? payload.tenantId : null;
    const tenantSlug = typeof payload.tenantSlug === "string" ? payload.tenantSlug : null;

    if (role === USER_ROLE.MERCHANT_ADMIN && !tenantId) return null;
    if (role === USER_ROLE.SUPER_ADMIN && tenantId) return null;

    return { userId, email, role, tenantId, tenantSlug };
  } catch {
    return null;
  }
}

export async function createSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await encryptSession(payload);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return decryptSession(token);
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
