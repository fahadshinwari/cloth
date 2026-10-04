import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/constants";

/**
 * NOTE: This file runs before every request and must stay edge-safe.
 * It only verifies the JWT (jose works on edge) — it never touches the DB.
 * Full authorization (user/tenant status) is re-checked server-side in
 * lib/auth.ts on every request. Tenant identity always comes from the
 * signed session token, never from client input.
 */

const SECRET = process.env.AUTH_SECRET ?? "";
const encodedKey = new TextEncoder().encode(SECRET);

interface TokenPayload {
  role?: string;
  tenantSlug?: string | null;
}

async function readPayload(request: NextRequest): Promise<TokenPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !SECRET) return null;

  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

const SUPER_ADMIN_PREFIX = "/admin";
const MERCHANT_LOGIN = "/login";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const payload = await readPayload(request);

  const isAdminArea =
    pathname.startsWith(SUPER_ADMIN_PREFIX) || pathname.startsWith("/super-login");
  const isMerchantDashboard = pathname !== "/" && !pathname.startsWith("/admin") && !pathname.startsWith("/login") && !pathname.startsWith("/super-login");

  // --- Super Admin area ---
  if (pathname === "/super-login") {
    if (payload?.role === "super_admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (isAdminArea) {
    if (payload?.role !== "super_admin") {
      return NextResponse.redirect(new URL("/super-login", request.url));
    }
    return NextResponse.next();
  }

  // --- Merchant area: any non-platform path is treated as tenant space ---
  if (isMerchantDashboard) {
    const segments = pathname.split("/").filter(Boolean);
    const first = segments[0] ?? "";

    // Static slug-only pages (no dashboard segment) fall through to routing.
    if (!payload) {
      const url = new URL(MERCHANT_LOGIN, request.url);
      url.searchParams.set("next", pathname + search);
      return NextResponse.redirect(url);
    }

    if (payload.role === "super_admin") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    // Merchant admin: enforce the slug in the URL matches the session tenant.
    if (payload.role === "merchant_admin") {
      if (!payload.tenantSlug) {
        return NextResponse.redirect(new URL(MERCHANT_LOGIN, request.url));
      }

      // `/dashboard` without a slug → redirect into their own shop.
      if (first === "dashboard" || first === "settings") {
        const url = request.nextUrl.clone();
        url.pathname = `/${payload.tenantSlug}${pathname}`;
        return NextResponse.redirect(url);
      }

      if (first !== payload.tenantSlug) {
        // Trying to peek into another tenant → send them home.
        return NextResponse.redirect(new URL(`/${payload.tenantSlug}/dashboard`, request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except API routes, Next internals and static files.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml)$).*)",
  ],
};
