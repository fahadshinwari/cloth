import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { USER_ROLE } from "@/lib/constants";
import { getAuthContext } from "@/lib/auth";
import { getShopBySlug } from "@/lib/services/tenant.service";
import { buildReportTable, renderReportCsv, renderReportPdf } from "@/lib/report-export";
import { parseReportParams, toReportFilters } from "@/lib/report-params";

/**
 * Tenant-scoped report export endpoint.
 *
 * SECURITY:
 * - The slug in the URL identifies WHICH tenant's data, but authorization is
 *   decided ONLY by the signed session: a merchant admin may only export
 *   their own tenant (session.tenantSlug must equal the URL slug and the
 *   session tenantId must match the shop record). Super admins may export
 *   any tenant. Filter params (buyerId etc.) are scoped by the same tenantId,
 *   so cross-tenant ids simply match nothing.
 */

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug");

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await context.params;
  const slugParsed = slugSchema.safeParse(slug);
  if (!slugParsed.success) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  // Resolve the shop by slug (public identifier) and enforce session tenancy.
  const shop = await getShopBySlug(slugParsed.data);
  if (!shop) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (ctx.session.role === USER_ROLE.MERCHANT_ADMIN) {
    if (ctx.session.tenantSlug !== slugParsed.data || ctx.session.tenantId !== String(shop._id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  // Super admins may access any tenant; merchant admins only their own.

  const tenantId = String(shop._id);
  const url = new URL(request.url);

  const parsed = parseReportParams(Object.fromEntries(url.searchParams.entries()));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid params", details: parsed.errors }, { status: 400 });
  }
  const params = parsed.data;

  const filters = toReportFilters(params);
  const bucket = params.bucket ?? (params.type === "weekly" ? "week" : params.type === "monthly" ? "month" : "day");

  const table = await buildReportTable(tenantId, params.type, filters, bucket);

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${slugParsed.data}-${params.type}-${stamp}`;

  if (params.format === "csv") {
    const csv = renderReportCsv(table);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const pdf = renderReportPdf(table);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
