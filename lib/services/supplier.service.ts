import "server-only";

import mongoose from "mongoose";
import {
  buildLedgerView,
  LEDGER_SEMANTICS,
  type LedgerFilters,
  type LedgerView,
  type RawLedgerEntry,
} from "../ledger";
import {
  ShopModel,
  SupplierLedgerEntryModel,
  SupplierModel,
  type SupplierDocument,
  type SupplierLedgerEntryDocument,
} from "../models";
import { connectToDatabase } from "../mongodb";
import { fromMinorUnits, toMinorUnits } from "../money";
import { SUPPLIER_LEDGER_ENTRY_TYPE } from "../constants";
import type { SupplierInput, SupplierLedgerEntryInput } from "../validation";

export class SupplierServiceError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "SupplierServiceError";
    this.field = field;
  }
}

function assertTenantId(tenantId: string): void {
  if (!/^[a-f\d]{24}$/i.test(tenantId)) {
    throw new SupplierServiceError("Invalid tenant.");
  }
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export async function listSuppliers(tenantId: string): Promise<SupplierDocument[]> {
  assertTenantId(tenantId);
  await connectToDatabase();
  return SupplierModel.find({ tenantId: toObjectId(tenantId) }).sort({ name: 1 });
}

export async function getSupplierById(
  tenantId: string,
  supplierId: string,
): Promise<SupplierDocument | null> {
  assertTenantId(tenantId);
  if (!/^[a-f\d]{24}$/i.test(supplierId)) return null;
  await connectToDatabase();
  // Tenant filter is always applied — an id alone can never leak another tenant's supplier.
  return SupplierModel.findOne({ _id: toObjectId(supplierId), tenantId: toObjectId(tenantId) });
}

/**
 * Maps supplier entries onto the shared ledger engine.
 * Semantics: Debit = payment made (owe less), Credit = clothing taken (owe more).
 */
export function toSupplierLedgerEntries(
  entries: SupplierLedgerEntryDocument[],
): RawLedgerEntry[] {
  return entries.map((entry) => ({
    id: String(entry._id),
    date: entry.occurredAt,
    description: entry.note || (entry.type === SUPPLIER_LEDGER_ENTRY_TYPE.PURCHASE ? "Clothing taken" : "Payment made"),
    debitMinor: entry.type === SUPPLIER_LEDGER_ENTRY_TYPE.PAYMENT ? entry.amountMinor : 0,
    creditMinor: entry.type === SUPPLIER_LEDGER_ENTRY_TYPE.PURCHASE ? entry.amountMinor : 0,
    currency: entry.currency as "AFN" | "USD",
    type: entry.type,
    source: entry.inventoryMovementId ? "purchase" : "manual",
  }));
}

/** Filterable ledger view for one supplier (uses the shared engine). */
export async function getSupplierLedgerView(
  tenantId: string,
  supplierId: string,
  filters: LedgerFilters = {},
): Promise<LedgerView> {
  const entries = await listSupplierLedgerEntries(tenantId, supplierId);
  return buildLedgerView(toSupplierLedgerEntries(entries), LEDGER_SEMANTICS.supplier, filters);
}

export async function countSuppliers(tenantId: string): Promise<number> {
  assertTenantId(tenantId);
  await connectToDatabase();
  return SupplierModel.countDocuments({ tenantId: toObjectId(tenantId) });
}

export async function createSupplier(
  tenantId: string,
  userId: string,
  input: SupplierInput,
): Promise<SupplierDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const duplicate = await SupplierModel.findOne({
    tenantId: toObjectId(tenantId),
    name: input.name,
  });
  if (duplicate) {
    throw new SupplierServiceError("A supplier with this name already exists.", "name");
  }

  return SupplierModel.create({
    tenantId: toObjectId(tenantId),
    name: input.name,
    companyName: input.companyName,
    phone: input.phone,
    address: input.address,
    notes: input.notes,
    status: input.status,
    createdBy: toObjectId(userId),
    updatedBy: toObjectId(userId),
  });
}

export async function updateSupplier(
  tenantId: string,
  supplierId: string,
  userId: string,
  input: SupplierInput,
): Promise<SupplierDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const supplier = await getSupplierById(tenantId, supplierId);
  if (!supplier) throw new SupplierServiceError("Supplier not found.");

  const duplicate = await SupplierModel.findOne({
    tenantId: toObjectId(tenantId),
    name: input.name,
    _id: { $ne: supplier._id },
  });
  if (duplicate) {
    throw new SupplierServiceError("A supplier with this name already exists.", "name");
  }

  supplier.name = input.name;
  supplier.companyName = input.companyName;
  supplier.phone = input.phone;
  supplier.address = input.address;
  supplier.notes = input.notes;
  supplier.status = input.status;
  supplier.updatedBy = toObjectId(userId);
  await supplier.save();
  return supplier;
}

// ---------------------------------------------------------------------------
// Ledger — payable balance is ALWAYS derived from entries, never stored
// ---------------------------------------------------------------------------

export async function listSupplierLedgerEntries(
  tenantId: string,
  supplierId?: string,
): Promise<SupplierLedgerEntryDocument[]> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const query: Record<string, unknown> = { tenantId: toObjectId(tenantId) };
  if (supplierId) {
    if (!/^[a-f\d]{24}$/i.test(supplierId)) return [];
    query.supplierId = toObjectId(supplierId);
  }

  // Chronological so partial payments replay in the right order.
  return SupplierLedgerEntryModel.find(query).sort({ occurredAt: 1, createdAt: 1 });
}

/**
 * Records a standalone money entry against a supplier:
 * `purchase` = clothing taken on credit (increases payable),
 * `payment`  = money paid to the supplier (decreases payable).
 */
export async function createSupplierLedgerEntry(
  tenantId: string,
  userId: string,
  input: SupplierLedgerEntryInput,
): Promise<SupplierLedgerEntryDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const supplier = await getSupplierById(tenantId, input.supplierId);
  if (!supplier) {
    throw new SupplierServiceError("Supplier not found.", "supplierId");
  }

  const amountMinor = toMinorUnits(input.amount, input.currency);
  if (amountMinor === null || amountMinor <= 0) {
    throw new SupplierServiceError("Invalid ledger amount.", "amount");
  }

  // Overpayment guard: a payment must not exceed the current payable for
  // that currency, unless the tenant allows advance payments.
  if (input.type === SUPPLIER_LEDGER_ENTRY_TYPE.PAYMENT) {
    const shop = await ShopModel.findById(tenantId).select("allowAdvancePayments").lean();
    if (!shop?.allowAdvancePayments) {
      const totals = await getSupplierLedgerTotals(tenantId, String(supplier._id));
      const payable = totals.payable[input.currency as "AFN" | "USD"];
      if (amountMinor > payable) {
        throw new SupplierServiceError(
          "Payment exceeds outstanding payable.",
          "amount",
        );
      }
    }
  }

  return SupplierLedgerEntryModel.create({
    tenantId: toObjectId(tenantId),
    supplierId: supplier._id,
    type: input.type,
    amountMinor,
    currency: input.currency,
    occurredAt: input.occurredAt,
    note: input.note,
    createdBy: toObjectId(userId),
  });
}

/**
 * Deletes a MANUAL supplier ledger entry. Entries linked to an inventory
 * movement must never be deleted alone — correct them with a reversing
 * entry instead, so financial history is preserved.
 */
export async function deleteSupplierLedgerEntry(
  tenantId: string,
  entryId: string,
): Promise<void> {
  assertTenantId(tenantId);
  if (!/^[a-f\d]{24}$/i.test(entryId)) return;
  await connectToDatabase();

  const entry = await SupplierLedgerEntryModel.findOne({
    _id: toObjectId(entryId),
    tenantId: toObjectId(tenantId),
  });
  if (!entry) return;
  if (entry.inventoryMovementId) {
    throw new SupplierServiceError(
      "This entry is part of an inventory transaction and cannot be deleted. Record a reversing purchase or payment instead.",
    );
  }
  await SupplierLedgerEntryModel.deleteOne({ _id: entry._id });
}

// ---------------------------------------------------------------------------
// Aggregations — always per currency, never merged
// ---------------------------------------------------------------------------

export interface SupplierTotals {
  purchases: { AFN: number; USD: number; display: Record<"AFN" | "USD", number> };
  payments: { AFN: number; USD: number; display: Record<"AFN" | "USD", number> };
  /** purchases − payments, per currency (what the merchant still owes). */
  payable: { AFN: number; USD: number; display: Record<"AFN" | "USD", number> };
}

function toTotals(entries: Array<{ currency: "AFN" | "USD"; amountMinor: number }>) {
  const totals = { AFN: 0, USD: 0 };
  for (const entry of entries) {
    totals[entry.currency] += entry.amountMinor;
  }
  return {
    AFN: totals.AFN,
    USD: totals.USD,
    display: {
      AFN: fromMinorUnits(totals.AFN, "AFN"),
      USD: fromMinorUnits(totals.USD, "USD"),
    },
  };
}

function buildTotals(
  purchases: Array<{ currency: "AFN" | "USD"; amountMinor: number }>,
  payments: Array<{ currency: "AFN" | "USD"; amountMinor: number }>,
): SupplierTotals {
  const purchasesTotals = toTotals(purchases);
  const paymentsTotals = toTotals(payments);
  return {
    purchases: purchasesTotals,
    payments: paymentsTotals,
    payable: {
      AFN: purchasesTotals.AFN - paymentsTotals.AFN,
      USD: purchasesTotals.USD - paymentsTotals.USD,
      display: {
        AFN: fromMinorUnits(purchasesTotals.AFN - paymentsTotals.AFN, "AFN"),
        USD: fromMinorUnits(purchasesTotals.USD - paymentsTotals.USD, "USD"),
      },
    },
  };
}

/** Payable totals for one supplier (tenant-filtered). */
export async function getSupplierLedgerTotals(
  tenantId: string,
  supplierId: string,
): Promise<SupplierTotals> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const rows = await SupplierLedgerEntryModel.aggregate<{
    _id: { type: string; currency: "AFN" | "USD" };
    total: number;
  }>([
    { $match: { tenantId: toObjectId(tenantId), supplierId: toObjectId(supplierId) } },
    { $group: { _id: { type: "$type", currency: "$currency" }, total: { $sum: "$amountMinor" } } },
  ]);

  const purchases: Array<{ currency: "AFN" | "USD"; amountMinor: number }> = [];
  const payments: Array<{ currency: "AFN" | "USD"; amountMinor: number }> = [];
  for (const row of rows) {
    const bucket = row._id.type === SUPPLIER_LEDGER_ENTRY_TYPE.PURCHASE ? purchases : payments;
    bucket.push({ currency: row._id.currency, amountMinor: row.total });
  }
  return buildTotals(purchases, payments);
}

export interface SupplierWithTotals {
  supplier: SupplierDocument;
  totals: SupplierTotals;
}

/** All suppliers with per-supplier totals plus the tenant-wide grand totals. */
export async function getSuppliersWithLedgerTotals(tenantId: string): Promise<{
  overall: SupplierTotals;
  suppliers: SupplierWithTotals[];
}> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const [suppliers, rows] = await Promise.all([
    listSuppliers(tenantId),
    SupplierLedgerEntryModel.aggregate<{
      _id: { supplierId: mongoose.Types.ObjectId; type: string; currency: "AFN" | "USD" };
      total: number;
    }>([
      { $match: { tenantId: toObjectId(tenantId) } },
      {
        $group: {
          _id: { supplierId: "$supplierId", type: "$type", currency: "$currency" },
          total: { $sum: "$amountMinor" },
        },
      },
    ]),
  ]);

  const bySupplier = new Map<
    string,
    { purchases: Array<{ currency: "AFN" | "USD"; amountMinor: number }>; payments: Array<{ currency: "AFN" | "USD"; amountMinor: number }> }
  >();
  for (const row of rows) {
    const key = row._id.supplierId.toString();
    const bucket = bySupplier.get(key) ?? { purchases: [], payments: [] };
    const list = row._id.type === SUPPLIER_LEDGER_ENTRY_TYPE.PURCHASE ? bucket.purchases : bucket.payments;
    list.push({ currency: row._id.currency, amountMinor: row.total });
    bySupplier.set(key, bucket);
  }

  const suppliersWithTotals: SupplierWithTotals[] = suppliers.map((supplier) => {
    const bucket = bySupplier.get(String(supplier._id)) ?? { purchases: [], payments: [] };
    return { supplier, totals: buildTotals(bucket.purchases, bucket.payments) };
  });

  const overall = buildTotals(
    [...bySupplier.values()].flatMap((b) => b.purchases),
    [...bySupplier.values()].flatMap((b) => b.payments),
  );

  return { overall, suppliers: suppliersWithTotals };
}
