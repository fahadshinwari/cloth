import "server-only";

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
import { formatMeters } from "./measure";

/**
 * Report rendering for CSV and PDF exports. All data functions are
 * tenant-scoped (lib/reports.ts); the tenantId passed here must come from
 * the authenticated session, never from client input.
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

function fmtDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function windowMeta(filters: ReportFilters): Array<[string, string]> {
  const meta: Array<[string, string]> = [];
  if (filters.from) meta.push(["From", fmtDate(filters.from)]);
  if (filters.to) meta.push(["To", fmtDate(filters.to)]);
  if (filters.currency) meta.push(["Currency", filters.currency]);
  if (filters.type) meta.push(["Transaction type", filters.type]);
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
  return lines.join("\r\n");
}

// ---------------------------------------------------------------------------
// PDF — minimal single-font renderer (no external deps, no web fonts)
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 792; // Letter landscape, pt
const PAGE_HEIGHT = 612;
const MARGIN = 40;
const LINE_HEIGHT = 14;
const MAX_TEXT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** Helvetica widths (approximation): use 0.5 × size per char for layout only. */
function textWidth(text: string, size: number): number {
  return text.length * size * 0.5;
}

function clipToWidth(text: string, size: number, maxWidth: number): string {
  if (textWidth(text, size) <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && textWidth(`${clipped}…`, size) > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}…`;
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

interface PageOp {
  ops: string[];
}

function createPage(): PageOp {
  return { ops: [] };
}

function drawText(page: PageOp, x: number, y: number, text: string, size = 9, bold = false): void {
  page.ops.push(
    `BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${escapePdfText(text)}) Tj ET`,
  );
}

function drawLine(page: PageOp, x1: number, y1: number, x2: number, y2: number): void {
  page.ops.push(`${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`);
}

interface PdfDoc {
  pages: PageOp[];
}

function newPdf(): PdfDoc {
  return { pages: [createPage()] };
}

function addPage(doc: PdfDoc): PageOp {
  const page = createPage();
  doc.pages.push(page);
  return page;
}

/** Column x positions distributed across the usable width. */
function columnX(count: number): number[] {
  const usable = MAX_TEXT_WIDTH;
  const width = usable / count;
  return Array.from({ length: count }, (_, index) => MARGIN + index * width);
}

function renderSection(
  pageArg: PageOp,
  doc: PdfDoc,
  section: ReportSection,
  state: { y: number },
): PageOp {
  let page = pageArg;
  // Section title
  if (state.y < MARGIN + LINE_HEIGHT * 3) {
    page = addPage(doc);
  }
  drawText(page, MARGIN, state.y, section.title, 11, true);
  state.y -= LINE_HEIGHT * 1.5;

  const xs = columnX(section.columns.length);
  for (let i = 0; i < section.columns.length; i += 1) {
    drawText(page, xs[i], state.y, clipToWidth(section.columns[i], 9, MAX_TEXT_WIDTH / section.columns.length - 4), 9, true);
  }
  drawLine(page, MARGIN, state.y - 4, PAGE_WIDTH - MARGIN, state.y - 4);
  state.y -= LINE_HEIGHT + 2;

  for (const row of section.rows) {
    if (state.y < MARGIN + LINE_HEIGHT) {
      page = addPage(doc);
      state.y = PAGE_HEIGHT - MARGIN;
      for (let i = 0; i < section.columns.length; i += 1) {
        drawText(page, xs[i], state.y, clipToWidth(section.columns[i], 9, MAX_TEXT_WIDTH / section.columns.length - 4), 9, true);
      }
      state.y -= LINE_HEIGHT + 2;
    }
    for (let i = 0; i < row.length; i += 1) {
      drawText(
        page,
        xs[i],
        state.y,
        clipToWidth(row[i] ?? "", 9, MAX_TEXT_WIDTH / section.columns.length - 4),
        9,
      );
    }
    state.y -= LINE_HEIGHT;
  }
  state.y -= LINE_HEIGHT;
  return page;
}

export function renderReportPdf(table: ReportTable): Buffer {
  const doc = newPdf();
  const page = doc.pages[0];
  let y = PAGE_HEIGHT - MARGIN;

  // Title
  drawText(page, MARGIN, y, table.title, 16, true);
  y -= LINE_HEIGHT * 2;

  // Meta (filters)
  for (const [key, value] of table.meta) {
    drawText(page, MARGIN, y, `${key}: ${value}`, 9);
    y -= LINE_HEIGHT;
  }
  if (table.meta.length > 0) y -= LINE_HEIGHT * 0.5;

  renderSection(page, doc, { title: "", columns: table.columns, rows: table.rows }, { y });
  // Continue remaining sections on the current last page (renderSection may
  // have appended pages if the main table overflowed).
  let lastPage = doc.pages[doc.pages.length - 1];
  for (const section of table.sections ?? []) {
    lastPage = renderSection(lastPage, doc, section, {
      y: PAGE_HEIGHT - MARGIN,
    });
  }

  // --- Serialize ---
  const objects: string[] = [];
  const pageCount = doc.pages.length;

  const pageObjIds = doc.pages.map((_, index) => 4 + index * 2);

  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  const kids = pageObjIds.map((id) => `${id} 0 R`).join(" ");
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`);
  objects.push(`3 0 obj\n<< /F1 /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);
  objects.push(`4 0 obj\n<< /F2 /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`);

  doc.pages.forEach((p, index) => {
    const contentId = pageObjIds[index] + 1;
    const content = p.ops.join("\n");
    objects.push(
      `${pageObjIds[index]} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`,
    );
    objects.push(
      `${contentId} 0 obj\n<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream\nendobj\n`,
    );
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += obj;
  }

  const xrefPos = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

// ---------------------------------------------------------------------------
// Build the table for a report type
// ---------------------------------------------------------------------------

export async function buildReportTable(
  tenantId: string,
  type: ReportType,
  filters: ReportFilters,
  bucket: "day" | "week" | "month" = "day",
): Promise<ReportTable> {
  switch (type) {
    case "daily":
    case "weekly":
    case "monthly": {
      const rows = await getPeriodReport(tenantId, bucket, filters);
      return {
        title:
          type === "daily"
            ? "Daily transactions"
            : type === "weekly"
              ? "Weekly transactions"
              : "Monthly transactions",
        columns: ["Period", "Currency", "Goods given", "Payments received", "Purchases", "Supplier payments", "Investments", "Teller in", "Teller out"],
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
        meta: windowMeta(filters),
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
            entry.description,
            entry.type,
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
                title: "Buyer transaction history",
                columns: ["Buyer", "Date", "Description", "Type", "Debit", "Credit", "Currency"],
                rows: historyRows,
              },
            ]
          : [];

      return {
        title: "Buyer report",
        columns: ["Buyer", "Shop", "Phone", "Currency", "Clothes received", "Payments", "Outstanding"],
        rows: rows.map((row) => [
          row.name,
          row.shopName,
          row.phone,
          row.currency,
          money(row.goodsMinor, row.currency),
          money(row.paymentsMinor, row.currency),
          money(row.outstandingMinor, row.currency),
        ]),
        meta: windowMeta(filters),
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
            entry.description,
            entry.type,
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
                title: "Supplier transaction history",
                columns: ["Supplier", "Date", "Description", "Type", "Debit", "Credit", "Currency"],
                rows: historyRows,
              },
            ]
          : [];

      return {
        title: "Supplier report",
        columns: ["Supplier", "Company", "Phone", "Currency", "Clothing received", "Payments made", "Outstanding payable"],
        rows: rows.map((row) => [
          row.name,
          row.companyName,
          row.phone,
          row.currency,
          money(row.purchasesMinor, row.currency),
          money(row.paymentsMinor, row.currency),
          money(row.payableMinor, row.currency),
        ]),
        meta: windowMeta(filters),
        sections,
      };
    }

    case "inventory": {
      const rows = await getInventoryReport(tenantId, filters);
      return {
        title: "Inventory report",
        columns: ["Cloth", "Category", "Meters in", "Meters out", "Current meters", "Price per meter", "Inventory value", "Currency"],
        rows: rows.map((row) => [
          row.name,
          row.category,
          row.metersIn.toFixed(3),
          row.metersOut.toFixed(3),
          formatMeters(row.currentMm),
          money(row.pricePerMeterMinor, row.currency),
          money(row.valueMinor, row.currency),
          row.currency,
        ]),
        meta: windowMeta(filters),
      };
    }

    case "partners": {
      const rows = await getPartnerReport(tenantId, filters);
      return {
        title: "Partner investment report",
        columns: ["Partner", "Phone", "Currency", "Invested"],
        rows: rows.map((row) => [row.name, row.phone, row.currency, money(row.investedMinor, row.currency)]),
        meta: windowMeta(filters),
      };
    }

    case "teller": {
      const rows = await getTellerReport(tenantId, bucket, filters);
      return {
        title: "Teller report",
        columns: ["Period", "Currency", "Cash in", "Cash out", "Net"],
        rows: rows.map((row) => [
          row.period,
          row.currency,
          money(row.inflowMinor, row.currency),
          money(row.outflowMinor, row.currency),
          money(row.netMinor, row.currency),
        ]),
        meta: windowMeta(filters),
      };
    }
  }
}
