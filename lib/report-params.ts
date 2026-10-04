import { z } from "zod";

/**
 * Zod validation for report/export query params. These come from the client,
 * so everything except filters is rejected; tenancy is NEVER accepted here —
 * it is resolved from the authenticated session on the server.
 *
 * Params:
 *   type            — report type (daily, weekly, monthly, buyers, ...)
 *   format          — csv | pdf
 *   from / to       — inclusive date window (yyyy-mm-dd)
 *   buyerId         — filter buyer reports to one buyer
 *   supplierId      — filter supplier reports to one supplier
 *   clothId         — filter inventory report to one cloth
 *   currency        — AFN | USD
 *   transactionType — goods|payment|purchase|add|remove
 *   bucket          — teller grouping: day | week | month
 */

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Must be a 24-char hex id");

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be yyyy-mm-dd")
  .transform((value) => new Date(`${value}T00:00:00`));

export const REPORT_TYPES = [
  "daily",
  "weekly",
  "monthly",
  "buyers",
  "suppliers",
  "inventory",
  "partners",
  "teller",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const reportParamsSchema = z
  .object({
    type: z.enum(REPORT_TYPES),
    format: z.enum(["csv", "pdf"]),
    from: dateParam.optional(),
    to: dateParam.optional(),
    buyerId: objectId.optional(),
    supplierId: objectId.optional(),
    clothId: objectId.optional(),
    currency: z.enum(["AFN", "USD"]).optional(),
    transactionType: z.string().trim().max(40).optional(),
    bucket: z.enum(["day", "week", "month"]).optional(),
  })
  .refine(
    (data) => !data.from || !data.to || data.from <= data.to,
    { message: "from must be on or before to", path: ["from"] },
  );

export type ReportParams = z.infer<typeof reportParamsSchema>;

/** Reads a single value from Next.js searchParams. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseReportParams(
  searchParams: Record<string, string | string[] | undefined>,
): { success: true; data: ReportParams } | { success: false; errors: Record<string, string> } {
  const parsed = reportParamsSchema.safeParse({
    type: first(searchParams.type),
    format: first(searchParams.format),
    from: first(searchParams.from),
    to: first(searchParams.to),
    buyerId: first(searchParams.buyerId),
    supplierId: first(searchParams.supplierId),
    clothId: first(searchParams.clothId),
    currency: first(searchParams.currency),
    transactionType: first(searchParams.transactionType),
    bucket: first(searchParams.bucket),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!errors[key]) errors[key] = issue.message;
    }
    return { success: false, errors };
  }

  return { success: true, data: parsed.data };
}

/** Builds the filter object consumed by lib/reports.ts. */
export function toReportFilters(params: ReportParams) {
  return {
    from: params.from,
    to: params.to,
    buyerId: params.buyerId,
    supplierId: params.supplierId,
    clothId: params.clothId,
    currency: params.currency,
    type: params.transactionType,
  };
}
