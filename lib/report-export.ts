import "server-only";

import * as XLSX from "xlsx";
import {
  getBuyerHistory,
  getBuyerReport,
  getInventoryReport,
  getPartnerReport,
  getPeriodReport,
  getSupplierHistory,
  getSupplierReport,
  getTellerReport,
  type ReportFilters,
  type ReportType,
} from "./reports";
import { formatMinorAmount } from "./money";
import { formatQuantity, pricePerYardMinor } from "./measure";
import { getTranslator } from "./i18n/dictionaries";
import type { Locale } from "./constants";

/**
 * Report rendering for CSV and XLSX exports. All data functions are
 * tenant-scoped (lib/reports.ts); the tenantId passed here must come from
 * the authenticated session, never from client input.
 *
 * Headers, section titles and filter labels are translated with the same
 * dictionaries as the on-screen reports, so exports match the active locale.
 */

export interface ReportSection {
  title: string;
  columns: string[];
  /** Pre-formatted, human-readable cell values. */
  rows: string[][];
}

export interface ReportTable {
  title: string;
  columns: string[];
  rows: string[][];
  meta: Array<[string, string]>;
  /** Optional extra sections (e.g. transaction history). */
  sections?: ReportSection[];
}

function money(minor: number, currency: "AFN" | "USD"): string {
  return formatMinorAmount(minor, currency);
}

/**
 * Normalize phone numbers to the app's canonical display format: "+93 XXX XXX XXX".
 * Accepts a range of common inputs (e.g. "07012345678", "+93700000000",
 * "+93 700 000 000") and normalizes Afghanistan mobile numbers to the same
 * grouped format the rest of the UI uses.
 */
function normalizedPhone(raw: string): string {
  const digits = String(raw ?? "").replace(/\D+/g, "");
  if (!digits) return "";
  let core = digits;
  if (core.startsWith("937")) core = core.slice(2);
  else if (core.startsWith("93")) core = core.slice(2);
  if (core.startsWith("0")) core = core.slice(1);
  if (/^\d{9}$/.test(core)) {
    return `+93 ${core.slice(0, 3)} ${core.slice(3, 6)} ${core.slice(6, 9)}`;
  }
  // Not a recognized mobile number: return the original trimmed value so a
  // non-AFN number or unusual format is still shown rather than blanked.
  return String(raw).trim();
}

function fmtDate(date: Date): string {
  // Reports use Kabul local time (Asia/Kabul, +04:30), matching the aggregation
  // timezone used in lib/reports.ts.
  const utc = date.getTime() + date.getTimezoneOffset() * 60_000;
  const KabulOffset = 4.5 * 3_600_000;
  const kabul = new Date(utc + KabulOffset);
  const y = kabul.getUTCFullYear();
  const m = String(kabul.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kabul.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function windowMeta(
  filters: ReportFilters,
  t: ReturnType<typeof getTranslator>,
): Array<[string, string]> {
  const meta: Array<[string, string]> = [];
  if (filters.from) meta.push([t("reports.meta.from"), fmtDate(filters.from)]);
  if (filters.to) meta.push([t("reports.meta.to"), fmtDate(filters.to)]);
  if (filters.currency) meta.push([t("reports.meta.currency"), filters.currency]);
  if (filters.type) {
    meta.push([t("reports.meta.transactionType"), t(`reports.transactionTypes.${filters.type}`)]);
  }
  return meta;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (/[",\n;]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function csvSection(section: ReportSection): string[] {
  const lines: string[] = [];
  lines.push("");
  lines.push(csvEscape(section.title));
  lines.push(section.columns.map(csvEscape).join(","));
  for (const row of section.rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines;
}

export function renderReportCsv(table: ReportTable): string {
  const lines: string[] = [];
  lines.push(csvEscape(table.title));
  for (const [key, value] of table.meta) {
    lines.push(`${csvEscape(key)},${csvEscape(value)}`);
  }
  lines.push("");
  lines.push(table.columns.map(csvEscape).join(","));
  for (const row of table.rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  for (const section of table.sections ?? []) {
    lines.push(...csvSection(section));
  }
  // UTF-8 BOM so Excel opens non-Latin (Dari/Pashto) CSV text correctly.
  return `\uFEFF${lines.join("\r\n")}`;
}

// ---------------------------------------------------------------------------
// XLSX — generated in-process with the pure-JS SheetJS writer. No native
// modules, no filesystem access, so it works on serverless hosts (Vercel).
// ---------------------------------------------------------------------------

export function renderReportXlsx(table: ReportTable): Buffer {
  const rows: Array<Array<string | number>> = [];
  rows.push([table.title]);
  for (const [key, value] of table.meta) {
    rows.push([key, value]);
  }
  rows.push([]);
  rows.push(table.columns);
  for (const row of table.rows) rows.push(row);

  for (const section of table.sections ?? []) {
    rows.push([]);
    rows.push([section.title]);
    rows.push(section.columns);
    for (const row of section.rows) rows.push(row);
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// ---------------------------------------------------------------------------
// Build the table for a report type
// ---------------------------------------------------------------------------

export async function buildReportTable(
  tenantId: string,
  type: ReportType,
  filters: ReportFilters,
  bucket: "day" | "week" | "month" = "day",
  locale: Locale = "en",
): Promise<ReportTable> {
  const t = getTranslator(locale);

  switch (type) {
    case "daily":
    case "weekly":
    case "monthly": {
      const rows = await getPeriodReport(tenantId, bucket, filters);
      return {
        title: t(`reports.titles.${type}`),
        columns: [
          t("reports.columns.period"),
          t("reports.columns.currency"),
          t("reports.columns.goodsGiven"),
          t("reports.columns.paymentsReceived"),
          t("reports.columns.purchases"),
          t("reports.columns.supplierPayments"),
          t("reports.columns.investments"),
          t("reports.columns.tellerIn"),
          t("reports.columns.tellerOut"),
        ],
        rows: rows.map((row) => [
          row.period,
          row.currency,
          money(row.goodsMinor, row.currency),
          money(row.paymentsMinor, row.currency),
          money(row.purchasesMinor, row.currency),
          money(row.supplierPaymentsMinor, row.currency),
          money(row.investmentsMinor, row.currency),
          money(row.tellerInMinor, row.currency),
          money(row.tellerOutMinor, row.currency),
        ]),
        meta: windowMeta(filters, t),
      };
    }

    case "buyers": {
      const rows = await getBuyerReport(tenantId, filters);
      const historyRows: string[][] = [];
      for (const row of rows) {
        const history = await getBuyerHistory(tenantId, row.buyerId, filters);
        for (const entry of history) {
          historyRows.push([
            row.name,
            fmtDate(entry.date),
            entry.billNo,
            entry.description,
            t(`reports.transactionTypes.${entry.type}`),
            money(entry.debitMinor, entry.currency),
            money(entry.creditMinor, entry.currency),
            entry.currency,
          ]);
        }
      }
      const sections: ReportSection[] =
        historyRows.length > 0
          ? [
              {
                title: t("reports.sections.buyerHistory"),
                columns: [
                  t("reports.columns.buyer"),
                  t("reports.columns.date"),
                  t("reports.columns.billNo"),
                  t("reports.columns.description"),
                  t("reports.columns.type"),
                  t("reports.columns.debit"),
                  t("reports.columns.credit"),
                  t("reports.columns.currency"),
                ],
                rows: historyRows,
              },
            ]
          : [];

      return {
        title: t("reports.titles.buyers"),
        columns: [
          t("reports.columns.buyer"),
          t("reports.columns.shop"),
          t("reports.columns.phone"),
          t("reports.columns.currency"),
          t("reports.columns.clothesReceived"),
          t("reports.columns.payments"),
          t("reports.columns.outstanding"),
        ],
        rows: rows.map((row) => [
          row.name,
          row.shopName,
          normalizedPhone(row.phone),
          row.currency,
          money(row.goodsMinor, row.currency),
          money(row.paymentsMinor, row.currency),
          money(row.outstandingMinor, row.currency),
        ]),
        meta: windowMeta(filters, t),
        sections,
      };
    }

    case "suppliers": {
      const rows = await getSupplierReport(tenantId, filters);
      const historyRows: string[][] = [];
      for (const row of rows) {
        const history = await getSupplierHistory(tenantId, row.supplierId, filters);
        for (const entry of history) {
          historyRows.push([
            row.name,
            fmtDate(entry.date),
            entry.billNo,
            entry.description,
            t(`reports.transactionTypes.${entry.type}`),
            money(entry.debitMinor, entry.currency),
            money(entry.creditMinor, entry.currency),
            entry.currency,
          ]);
        }
      }
      const sections: ReportSection[] =
        historyRows.length > 0
          ? [
              {
                title: t("reports.sections.supplierHistory"),
                columns: [
                  t("reports.columns.supplier"),
                  t("reports.columns.date"),
                  t("reports.columns.billNo"),
                  t("reports.columns.description"),
                  t("reports.columns.type"),
                  t("reports.columns.debit"),
                  t("reports.columns.credit"),
                  t("reports.columns.currency"),
                ],
                rows: historyRows,
              },
            ]
          : [];

      return {
        title: t("reports.titles.suppliers"),
        columns: [
          t("reports.columns.supplier"),
          t("reports.columns.company"),
          t("reports.columns.phone"),
          t("reports.columns.currency"),
          t("reports.columns.clothingReceived"),
          t("reports.columns.paymentsMade"),
          t("reports.columns.outstandingPayable"),
        ],
        rows: rows.map((row) => [
          row.name,
          row.companyName,
          normalizedPhone(row.phone),
          row.currency,
          money(row.purchasesMinor, row.currency),
          money(row.paymentsMinor, row.currency),
          money(row.payableMinor, row.currency),
        ]),
        meta: windowMeta(filters, t),
        sections,
      };
    }

    case "inventory": {
      const rows = await getInventoryReport(tenantId, filters);
      return {
        title: t("reports.titles.inventory"),
        columns: [
          t("reports.columns.cloth"),
          t("reports.columns.code"),
          t("reports.columns.category"),
          t("reports.columns.metersIn"),
          t("reports.columns.metersOut"),
          t("reports.columns.currentMeters"),
          t("reports.columns.pricePerMeter"),
          t("reports.columns.inventoryValue"),
          t("reports.columns.currency"),
        ],
        rows: rows.map((row) => [
          row.name,
          row.code,
          row.category,
          row.yardsIn.toFixed(3),
          row.yardsOut.toFixed(3),
          formatQuantity(row.currentMm, "yard", t("units.yd")),
          money(pricePerYardMinor(row.pricePerMeterMinor), row.currency),
          money(row.valueMinor, row.currency),
          row.currency,
        ]),
        meta: windowMeta(filters, t),
      };
    }

    case "partners": {
      const rows = await getPartnerReport(tenantId, filters);
      return {
        title: t("reports.titles.partners"),
        columns: [
          t("reports.columns.partner"),
          t("reports.columns.phone"),
          t("reports.columns.currency"),
          t("reports.columns.invested"),
        ],
        rows: rows.map((row) => [
          row.name,
          normalizedPhone(row.phone),
          row.currency,
          money(row.investedMinor, row.currency),
        ]),
        meta: windowMeta(filters, t),
      };
    }

    case "teller": {
      const rows = await getTellerReport(tenantId, bucket, filters);
      return {
        title: t("reports.titles.teller"),
        columns: [
          t("reports.columns.period"),
          t("reports.columns.currency"),
          t("reports.columns.cashIn"),
          t("reports.columns.cashOut"),
          t("reports.columns.net"),
        ],
        rows: rows.map((row) => [
          row.period,
          row.currency,
          money(row.inflowMinor, row.currency),
          money(row.outflowMinor, row.currency),
          money(row.netMinor, row.currency),
        ]),
        meta: windowMeta(filters, t),
      };
    }
  }
}
