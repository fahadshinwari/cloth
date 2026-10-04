import "server-only";

import mongoose from "mongoose";
import {
  BuyerModel,
  ClothModel,
  InvestmentModel,
  InventoryMovementModel,
  LedgerEntryModel,
  PartnerModel,
  SupplierLedgerEntryModel,
  SupplierModel,
  TellerTransactionModel,
} from "./models";
import { connectToDatabase } from "./mongodb";
import {
  INVENTORY_DIRECTION,
  LEDGER_ENTRY_TYPE,
  SUPPLIER_LEDGER_ENTRY_TYPE,
  TELLER_TRANSACTION_TYPE,
  type Currency,
} from "./constants";
import { formatMinorAmount, fromMinorUnits } from "./money";
import { formatMeters } from "./measure";

/**
 * Server-side reporting engine. Every function is tenant-scoped: the caller
 * passes a tenantId resolved from the authenticated session and every query
 * below filters on it. Client input only ever supplies filters (dates, ids,
 * currency, type) — never tenancy.
 */

export type ReportType =
  | "daily"
  | "weekly"
  | "monthly"
  | "buyers"
  | "suppliers"
  | "inventory"
  | "partners"
  | "teller";

export interface ReportFilters {
  from?: Date;
  to?: Date;
  buyerId?: string;
  supplierId?: string;
  clothId?: string;
  currency?: Currency;
  type?: string;
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function matchCurrency(filters: ReportFilters): Record<string, unknown> {
  return filters.currency ? { currency: filters.currency } : {};
}

function inWindow(field: string, filters: ReportFilters): Record<string, unknown> {
  const range: Record<string, Date> = {};
  if (filters.from) range.$gte = startOfDay(filters.from);
  if (filters.to) range.$lte = endOfDay(filters.to);
  return Object.keys(range).length > 0 ? { [field]: range } : {};
}

/** Minimal shape of a lean buyer/supplier/cloth/partner used in reports. */
interface ReportParty {
  _id: mongoose.Types.ObjectId;
  name: string;
  shopName?: string;
  companyName?: string;
  phone?: string;
  category?: string;
  pricePerMeterMinor?: number;
  currency?: string;
}

async function findParties(
  model: mongoose.Model<unknown>,
  tenantId: string,
): Promise<ReportParty[]> {
  const rows = await model.find({ tenantId: toObjectId(tenantId) }).lean();
  return rows as unknown as ReportParty[];
}

// ---------------------------------------------------------------------------
// Daily / weekly / monthly transaction reports
// ---------------------------------------------------------------------------

export interface PeriodRow {
  period: string;
  goodsMinor: number;
  paymentsMinor: number;
  purchasesMinor: number;
  supplierPaymentsMinor: number;
  investmentsMinor: number;
  tellerInMinor: number;
  tellerOutMinor: number;
  /** AFN/USD kept separate: totals per currency are returned as maps. */
  currency: Currency;
}

type Bucket = "day" | "week" | "month";

function periodExpression(field: string, bucket: Bucket) {
  if (bucket === "day") {
    return {
      year: { $year: { date: `$${field}`, timezone: "+04:30" } },
      month: { $month: { date: `$${field}`, timezone: "+04:30" } },
      day: { $dayOfMonth: { date: `$${field}`, timezone: "+04:30" } },
    };
  }
  if (bucket === "week") {
    return {
      year: { $year: { date: `$${field}`, timezone: "+04:30" } },
      week: { $isoWeek: { date: `$${field}`, timezone: "+04:30" } },
    };
  }
  return {
    year: { $year: { date: `$${field}`, timezone: "+04:30" } },
    month: { $month: { date: `$${field}`, timezone: "+04:30" } },
  };
}

function periodKey(id: { year: number; month?: number; day?: number; week?: number }, bucket: Bucket): string {
  if (bucket === "day") {
    return `${id.year}-${String(id.month).padStart(2, "0")}-${String(id.day).padStart(2, "0")}`;
  }
  if (bucket === "week") {
    return `${id.year}-W${String(id.week).padStart(2, "0")}`;
  }
  return `${id.year}-${String(id.month).padStart(2, "0")}`;
}

interface PeriodAggRow {
  _id: { year: number; month?: number; day?: number; week?: number; currency: Currency };
  goods: number;
  payments: number;
  purchases: number;
  supplierPayments: number;
  investments: number;
  tellerIn: number;
  tellerOut: number;
}

async function aggregatePeriods(
  tenantId: string,
  bucket: Bucket,
  filters: ReportFilters,
): Promise<PeriodAggRow[]> {
  const tenant = toObjectId(tenantId);

  const [buyerRows, supplierRows, investmentRows, tellerRows] = await Promise.all([
    LedgerEntryModel.aggregate<{ _id: PeriodAggRow["_id"]; total: number }>([
      { $match: { tenantId: tenant, ...inWindow("occurredAt", filters), ...matchCurrency(filters) } },
      {
        $group: {
          _id: { ...periodExpression("occurredAt", bucket), currency: "$currency" },
          goods: { $sum: { $cond: [{ $eq: ["$type", LEDGER_ENTRY_TYPE.GOODS] }, "$amountMinor", 0] } },
          payments: { $sum: { $cond: [{ $eq: ["$type", LEDGER_ENTRY_TYPE.PAYMENT] }, "$amountMinor", 0] } },
        },
      },
    ]),
    SupplierLedgerEntryModel.aggregate<{ _id: PeriodAggRow["_id"]; purchases: number; supplierPayments: number }>([
      { $match: { tenantId: tenant, ...inWindow("occurredAt", filters), ...matchCurrency(filters) } },
      {
        $group: {
          _id: { ...periodExpression("occurredAt", bucket), currency: "$currency" },
          purchases: { $sum: { $cond: [{ $eq: ["$type", SUPPLIER_LEDGER_ENTRY_TYPE.PURCHASE] }, "$amountMinor", 0] } },
          supplierPayments: { $sum: { $cond: [{ $eq: ["$type", SUPPLIER_LEDGER_ENTRY_TYPE.PAYMENT] }, "$amountMinor", 0] } },
        },
      },
    ]),
    InvestmentModel.aggregate<{ _id: PeriodAggRow["_id"]; investments: number }>([
      { $match: { tenantId: tenant, ...inWindow("investedAt", filters), ...matchCurrency(filters) } },
      {
        $group: {
          _id: { ...periodExpression("investedAt", bucket), currency: "$currency" },
          investments: { $sum: "$amountMinor" },
        },
      },
    ]),
    TellerTransactionModel.aggregate<{ _id: PeriodAggRow["_id"]; tellerIn: number; tellerOut: number }>([
      { $match: { tenantId: tenant, ...inWindow("occurredAt", filters), ...matchCurrency(filters) } },
      {
        $group: {
          _id: { ...periodExpression("occurredAt", bucket), currency: "$currency" },
          tellerIn: { $sum: { $cond: [{ $eq: ["$type", TELLER_TRANSACTION_TYPE.ADD] }, "$amountMinor", 0] } },
          tellerOut: { $sum: { $cond: [{ $eq: ["$type", TELLER_TRANSACTION_TYPE.REMOVE] }, "$amountMinor", 0] } },
        },
      },
    ]),
  ]);

  const merged = new Map<string, PeriodAggRow>();
  type AggInput = {
    _id: { year: number; month?: number; day?: number; week?: number; currency: Currency };
  } & {
    [key: string]: number | undefined | { year: number; month?: number; day?: number; week?: number; currency: Currency };
  };
  const push = (row: AggInput, keys: Array<[string, string]>) => {
    const key = `${periodKey(row._id, bucket)}|${row._id.currency}`;
    const current: PeriodAggRow = merged.get(key) ?? {
      _id: row._id,
      goods: 0,
      payments: 0,
      purchases: 0,
      supplierPayments: 0,
      investments: 0,
      tellerIn: 0,
      tellerOut: 0,
    };
    for (const [field, column] of keys) {
      const value = row[field];
      (current as unknown as Record<string, number>)[column] = typeof value === "number" ? value : 0;
    }
    merged.set(key, current);
  };

  for (const row of buyerRows) push(row, [["goods", "goods"], ["payments", "payments"]]);
  for (const row of supplierRows) push(row, [["purchases", "purchases"], ["supplierPayments", "supplierPayments"]]);
  for (const row of investmentRows) push(row, [["investments", "investments"]]);
  for (const row of tellerRows) push(row, [["tellerIn", "tellerIn"], ["tellerOut", "tellerOut"]]);

  return [...merged.values()].sort((a, b) =>
    periodKey(a._id, bucket).localeCompare(periodKey(b._id, bucket)),
  );
}

export async function getPeriodReport(
  tenantId: string,
  bucket: Bucket,
  filters: ReportFilters = {},
): Promise<PeriodRow[]> {
  await connectToDatabase();
  const rows = await aggregatePeriods(tenantId, bucket, filters);
  return rows.map((row) => ({
    period: periodKey(row._id, bucket),
    currency: row._id.currency,
    goodsMinor: row.goods,
    paymentsMinor: row.payments,
    purchasesMinor: row.purchases,
    supplierPaymentsMinor: row.supplierPayments,
    investmentsMinor: row.investments,
    tellerInMinor: row.tellerIn,
    tellerOutMinor: row.tellerOut,
  }));
}

// ---------------------------------------------------------------------------
// Buyer report — per buyer: goods, payments, outstanding + history
// ---------------------------------------------------------------------------

export interface BuyerReportRow {
  buyerId: string;
  name: string;
  shopName: string;
  phone: string;
  goodsMinor: number;
  paymentsMinor: number;
  outstandingMinor: number;
  currency: Currency;
}

export async function getBuyerReport(
  tenantId: string,
  filters: ReportFilters = {},
): Promise<BuyerReportRow[]> {
  await connectToDatabase();

  const match: Record<string, unknown> = { tenantId: toObjectId(tenantId), ...inWindow("occurredAt", filters) };
  if (filters.buyerId) match.buyerId = toObjectId(filters.buyerId);
  if (filters.currency) match.currency = filters.currency;
  if (filters.type) match.type = filters.type;

  const rows = await LedgerEntryModel.aggregate<{
    _id: { buyerId: mongoose.Types.ObjectId; currency: Currency };
    goods: number;
    payments: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: { buyerId: "$buyerId", currency: "$currency" },
        goods: { $sum: { $cond: [{ $eq: ["$type", LEDGER_ENTRY_TYPE.GOODS] }, "$amountMinor", 0] } },
        payments: { $sum: { $cond: [{ $eq: ["$type", LEDGER_ENTRY_TYPE.PAYMENT] }, "$amountMinor", 0] } },
      },
    },
  ]);

  const buyers = await findParties(BuyerModel as unknown as mongoose.Model<unknown>, tenantId);
  const byBuyer = new Map(buyers.map((buyer) => [String(buyer._id), buyer]));

  const merged = new Map<string, BuyerReportRow>();
  for (const row of rows) {
    const key = row._id.buyerId.toString();
    const buyer = byBuyer.get(key);
    if (!buyer) continue;
    merged.set(`${key}|${row._id.currency}`, {
      buyerId: key,
      name: buyer.name,
      shopName: buyer.shopName ?? "",
      phone: buyer.phone ?? "",
      goodsMinor: row.goods,
      paymentsMinor: row.payments,
      outstandingMinor: row.goods - row.payments,
      currency: row._id.currency,
    });
  }

  // Include buyers with no activity in the window as explicit zero rows so
  // the report always shows every buyer's information and balance.
  // Party and currency filters constrain the zero rows too — filtering to one
  // buyer/currency must never emit rows for anyone else.
  const reportCurrencies: Currency[] = filters.currency ? [filters.currency] : ["AFN", "USD"];
  for (const buyer of buyers) {
    if (filters.buyerId && String(buyer._id) !== filters.buyerId) continue;
    for (const currency of reportCurrencies) {
      const key = `${String(buyer._id)}|${currency}`;
      if (!merged.has(key)) {
        merged.set(key, {
          buyerId: String(buyer._id),
          name: buyer.name,
          shopName: buyer.shopName ?? "",
          phone: buyer.phone ?? "",
          goodsMinor: 0,
          paymentsMinor: 0,
          outstandingMinor: 0,
          currency,
        });
      }
    }
  }

  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export interface LedgerHistoryRow {
  date: Date;
  description: string;
  type: string;
  debitMinor: number;
  creditMinor: number;
  currency: Currency;
}

/** Full transaction history for one buyer, tenant-scoped. */
export async function getBuyerHistory(
  tenantId: string,
  buyerId: string,
  filters: ReportFilters = {},
): Promise<LedgerHistoryRow[]> {
  await connectToDatabase();

  const match: Record<string, unknown> = {
    tenantId: toObjectId(tenantId),
    buyerId: toObjectId(buyerId),
  };
  if (filters.from) match.occurredAt = { ...(match.occurredAt as object ?? {}), $gte: startOfDay(filters.from) };
  if (filters.to) match.occurredAt = { ...(match.occurredAt as object ?? {}), $lte: endOfDay(filters.to) };
  if (filters.currency) match.currency = filters.currency;
  if (filters.type) match.type = filters.type;

  const entries = await LedgerEntryModel.find(match).sort({ occurredAt: 1 }).lean();

  return entries.map((entry) => ({
    date: entry.occurredAt,
    description: entry.note || (entry.type === LEDGER_ENTRY_TYPE.GOODS ? "Clothes given" : "Payment received"),
    type: entry.type,
    debitMinor: entry.type === LEDGER_ENTRY_TYPE.GOODS ? entry.amountMinor : 0,
    creditMinor: entry.type === LEDGER_ENTRY_TYPE.PAYMENT ? entry.amountMinor : 0,
    currency: entry.currency as Currency,
  }));
}

// ---------------------------------------------------------------------------
// Supplier report — clothes received, payments made, payable, history
// ---------------------------------------------------------------------------

export interface SupplierReportRow {
  supplierId: string;
  name: string;
  companyName: string;
  phone: string;
  purchasesMinor: number;
  paymentsMinor: number;
  payableMinor: number;
  currency: Currency;
}

export async function getSupplierReport(
  tenantId: string,
  filters: ReportFilters = {},
): Promise<SupplierReportRow[]> {
  await connectToDatabase();

  const match: Record<string, unknown> = { tenantId: toObjectId(tenantId), ...inWindow("occurredAt", filters) };
  if (filters.supplierId) match.supplierId = toObjectId(filters.supplierId);
  if (filters.currency) match.currency = filters.currency;
  if (filters.type) match.type = filters.type;

  const rows = await SupplierLedgerEntryModel.aggregate<{
    _id: { supplierId: mongoose.Types.ObjectId; currency: Currency };
    purchases: number;
    payments: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: { supplierId: "$supplierId", currency: "$currency" },
        purchases: { $sum: { $cond: [{ $eq: ["$type", SUPPLIER_LEDGER_ENTRY_TYPE.PURCHASE] }, "$amountMinor", 0] } },
        payments: { $sum: { $cond: [{ $eq: ["$type", SUPPLIER_LEDGER_ENTRY_TYPE.PAYMENT] }, "$amountMinor", 0] } },
      },
    },
  ]);

  const suppliers = await findParties(SupplierModel as unknown as mongoose.Model<unknown>, tenantId);
  const bySupplier = new Map(suppliers.map((supplier) => [String(supplier._id), supplier]));

  const merged = new Map<string, SupplierReportRow>();
  for (const row of rows) {
    const key = row._id.supplierId.toString();
    const supplier = bySupplier.get(key);
    if (!supplier) continue;
    merged.set(`${key}|${row._id.currency}`, {
      supplierId: key,
      name: supplier.name,
      companyName: supplier.companyName ?? "",
      phone: supplier.phone ?? "",
      purchasesMinor: row.purchases,
      paymentsMinor: row.payments,
      payableMinor: row.purchases - row.payments,
      currency: row._id.currency,
    });
  }

  // Include suppliers with no activity in the window as explicit zero rows.
  // Party and currency filters constrain the zero rows too.
  const reportCurrencies: Currency[] = filters.currency ? [filters.currency] : ["AFN", "USD"];
  for (const supplier of suppliers) {
    if (filters.supplierId && String(supplier._id) !== filters.supplierId) continue;
    for (const currency of reportCurrencies) {
      const key = `${String(supplier._id)}|${currency}`;
      if (!merged.has(key)) {
        merged.set(key, {
          supplierId: String(supplier._id),
          name: supplier.name,
          companyName: supplier.companyName ?? "",
          phone: supplier.phone ?? "",
          purchasesMinor: 0,
          paymentsMinor: 0,
          payableMinor: 0,
          currency,
        });
      }
    }
  }

  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSupplierHistory(
  tenantId: string,
  supplierId: string,
  filters: ReportFilters = {},
): Promise<LedgerHistoryRow[]> {
  await connectToDatabase();

  const match: Record<string, unknown> = {
    tenantId: toObjectId(tenantId),
    supplierId: toObjectId(supplierId),
  };
  if (filters.from) match.occurredAt = { ...(match.occurredAt as object ?? {}), $gte: startOfDay(filters.from) };
  if (filters.to) match.occurredAt = { ...(match.occurredAt as object ?? {}), $lte: endOfDay(filters.to) };
  if (filters.currency) match.currency = filters.currency;
  if (filters.type) match.type = filters.type;

  const entries = await SupplierLedgerEntryModel.find(match).sort({ occurredAt: 1 }).lean();

  return entries.map((entry) => ({
    date: entry.occurredAt,
    description: entry.note || (entry.type === SUPPLIER_LEDGER_ENTRY_TYPE.PURCHASE ? "Clothing taken" : "Payment made"),
    type: entry.type,
    debitMinor: entry.type === SUPPLIER_LEDGER_ENTRY_TYPE.PAYMENT ? entry.amountMinor : 0,
    creditMinor: entry.type === SUPPLIER_LEDGER_ENTRY_TYPE.PURCHASE ? entry.amountMinor : 0,
    currency: entry.currency as Currency,
  }));
}

// ---------------------------------------------------------------------------
// Inventory report — meters in / out, current stock, value per cloth
// ---------------------------------------------------------------------------

export interface InventoryReportRow {
  clothId: string;
  name: string;
  category: string;
  metersIn: number;
  metersOut: number;
  currentMm: number;
  pricePerMeterMinor: number;
  valueMinor: number;
  currency: Currency;
}

export async function getInventoryReport(
  tenantId: string,
  filters: ReportFilters = {},
): Promise<InventoryReportRow[]> {
  await connectToDatabase();

  const match: Record<string, unknown> = { tenantId: toObjectId(tenantId), ...inWindow("occurredAt", filters) };
  if (filters.clothId) match.clothId = toObjectId(filters.clothId);
  if (filters.currency) match.currency = filters.currency;

  const rows = await InventoryMovementModel.aggregate<{
    _id: { clothId: mongoose.Types.ObjectId; currency: Currency };
    metersInMm: number;
    metersOutMm: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: { clothId: "$clothId", currency: "$currency" },
        metersInMm: {
          $sum: { $cond: [{ $eq: ["$direction", INVENTORY_DIRECTION.IN] }, "$quantityMm", 0] },
        },
        metersOutMm: {
          $sum: { $cond: [{ $eq: ["$direction", INVENTORY_DIRECTION.OUT] }, "$quantityMm", 0] },
        },
      },
    },
  ]);

  // Current stock is lifetime (ignores the date window) by design.
  const stock = new Map<string, number>();
  const stockRows = await InventoryMovementModel.aggregate<{
    _id: mongoose.Types.ObjectId;
    signed: number;
  }>([
    { $match: { tenantId: toObjectId(tenantId) } },
    {
      $group: {
        _id: "$clothId",
        signed: {
          $sum: {
            $cond: [{ $eq: ["$direction", INVENTORY_DIRECTION.IN] }, "$quantityMm", { $multiply: ["$quantityMm", -1] }],
          },
        },
      },
    },
  ]);
  for (const row of stockRows) stock.set(row._id.toString(), row.signed);

  const cloths = await findParties(ClothModel as unknown as mongoose.Model<unknown>, tenantId);

  const result: InventoryReportRow[] = [];
  for (const cloth of cloths) {
    const clothId = String(cloth._id);
    // The clothId filter constrains the OUTPUT rows, not just the movement
    // aggregation, so a filtered report returns only the requested cloth.
    if (filters.clothId && clothId !== filters.clothId) continue;
    const row = rows.find((r) => r._id.clothId.toString() === clothId && r._id.currency === cloth.currency);
    const currentMm = stock.get(clothId) ?? 0;
    const price = cloth.pricePerMeterMinor ?? 0;
    result.push({
      clothId,
      name: cloth.name,
      category: cloth.category ?? "",
      metersIn: row ? row.metersInMm / 1000 : 0,
      metersOut: row ? row.metersOutMm / 1000 : 0,
      currentMm,
      pricePerMeterMinor: price,
      valueMinor: Math.round((currentMm / 1000) * price),
      currency: (cloth.currency ?? "AFN") as Currency,
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Partner investment report
// ---------------------------------------------------------------------------

export interface PartnerReportRow {
  partnerId: string;
  name: string;
  phone: string;
  investedMinor: number;
  currency: Currency;
}

export async function getPartnerReport(
  tenantId: string,
  filters: ReportFilters = {},
): Promise<PartnerReportRow[]> {
  await connectToDatabase();

  const match: Record<string, unknown> = { tenantId: toObjectId(tenantId), ...inWindow("investedAt", filters) };
  if (filters.currency) match.currency = filters.currency;

  const rows = await InvestmentModel.aggregate<{
    _id: { partnerId: mongoose.Types.ObjectId; currency: Currency };
    invested: number;
  }>([
    { $match: match },
    { $group: { _id: { partnerId: "$partnerId", currency: "$currency" }, invested: { $sum: "$amountMinor" } } },
  ]);

  const partners = await findParties(PartnerModel as unknown as mongoose.Model<unknown>, tenantId);
  const byPartner = new Map(partners.map((partner) => [String(partner._id), partner]));

  const merged = new Map<string, PartnerReportRow>();
  for (const row of rows) {
    const key = row._id.partnerId.toString();
    const partner = byPartner.get(key);
    if (!partner) continue;
    merged.set(`${key}|${row._id.currency}`, {
      partnerId: key,
      name: partner.name,
      phone: partner.phone ?? "",
      investedMinor: row.invested,
      currency: row._id.currency,
    });
  }

  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Teller report
// ---------------------------------------------------------------------------

export interface TellerReportRow {
  period: string;
  inflowMinor: number;
  outflowMinor: number;
  netMinor: number;
  currency: Currency;
}

export async function getTellerReport(
  tenantId: string,
  bucket: Bucket = "day",
  filters: ReportFilters = {},
): Promise<TellerReportRow[]> {
  await connectToDatabase();

  const match: Record<string, unknown> = { tenantId: toObjectId(tenantId), ...inWindow("occurredAt", filters) };
  if (filters.currency) match.currency = filters.currency;

  const rows = await TellerTransactionModel.aggregate<{
    _id: { year: number; month?: number; day?: number; week?: number; currency: Currency };
    inflow: number;
    outflow: number;
  }>([
    { $match: match },
    {
      $group: {
        _id: { ...periodExpression("occurredAt", bucket), currency: "$currency" },
        inflow: { $sum: { $cond: [{ $eq: ["$type", TELLER_TRANSACTION_TYPE.ADD] }, "$amountMinor", 0] } },
        outflow: { $sum: { $cond: [{ $eq: ["$type", TELLER_TRANSACTION_TYPE.REMOVE] }, "$amountMinor", 0] } },
      },
    },
  ]);

  return rows
    .map((row) => ({
      period: periodKey(row._id, bucket),
      inflowMinor: row.inflow,
      outflowMinor: row.outflow,
      netMinor: row.inflow - row.outflow,
      currency: row._id.currency,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

// ---------------------------------------------------------------------------
// Formatting helpers shared by report page + exporters
// ---------------------------------------------------------------------------

export function formatPeriodMoney(minor: number, currency: Currency): string {
  return formatMinorAmount(minor, currency);
}

export function minorToUnits(minor: number): number {
  return fromMinorUnits(minor, "AFN" as Currency);
}

export function metersToText(mm: number): string {
  return formatMeters(mm);
}
