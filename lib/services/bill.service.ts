import "server-only";

import mongoose from "mongoose";
import {
  BuyerModel,
  InventoryMovementModel,
  LedgerEntryModel,
  SupplierLedgerEntryModel,
  SupplierModel,
} from "../models";
import { connectToDatabase } from "../mongodb";
import { INVENTORY_SOURCE_TYPE } from "../constants";

/**
 * Bill search (tenant-scoped). Looks up buyer ledger entries and supplier
 * ledger entries by their bill/invoice number, plus inventory movements that
 * carry one, and resolves the party name for display.
 */

export type BillKind = "buyer" | "supplier";

export interface BillSearchRow {
  id: string;
  kind: BillKind;
  partyId: string;
  partyName: string;
  type: string;
  billNo: string;
  amountMinor: number;
  currency: "AFN" | "USD";
  occurredAt: Date;
  note: string;
  receivedBy: string;
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

function isObjectId(value: string): boolean {
  return /^[a-f\d]{24}$/i.test(value);
}

export async function searchBills(tenantId: string, query: string): Promise<BillSearchRow[]> {
  if (!isObjectId(tenantId)) return [];
  const billNo = query.trim();
  if (billNo === "") return [];

  await connectToDatabase();
  const tenant = toObjectId(tenantId);
  // Exact match first, then a case-insensitive prefix/substring match so
  // entering "20" still finds bill "202".
  const matcher = new RegExp(`^${escapeRegExp(billNo)}$`, "i");

  const [buyerEntries, supplierEntries, movements] = await Promise.all([
    LedgerEntryModel.find({ tenantId: tenant, billNo: matcher }).sort({ occurredAt: -1 }).limit(100).lean(),
    SupplierLedgerEntryModel.find({ tenantId: tenant, billNo: matcher }).sort({ occurredAt: -1 }).limit(100).lean(),
    InventoryMovementModel.find({ tenantId: tenant, billNo: matcher }).sort({ occurredAt: -1 }).limit(100).lean(),
  ]);

  // If no exact matches, fall back to a contains search.
  let buyerFallback: typeof buyerEntries = [];
  let supplierFallback: typeof supplierEntries = [];
  if (buyerEntries.length + supplierEntries.length + movements.length === 0) {
    [buyerFallback, supplierFallback] = await Promise.all([
      LedgerEntryModel.find({
        tenantId: tenant,
        billNo: new RegExp(escapeRegExp(billNo), "i"),
      })
        .sort({ occurredAt: -1 })
        .limit(100)
        .lean(),
      SupplierLedgerEntryModel.find({
        tenantId: tenant,
        billNo: new RegExp(escapeRegExp(billNo), "i"),
      })
        .sort({ occurredAt: -1 })
        .limit(100)
        .lean(),
    ]);
  }

  const buyers = await BuyerModel.find({ tenantId: tenant }).select("name").lean();
  const suppliers = await SupplierModel.find({ tenantId: tenant }).select("name").lean();
  const buyerNames = new Map(buyers.map((row) => [String(row._id), row.name]));
  const supplierNames = new Map(suppliers.map((row) => [String(row._id), row.name]));

  const rows: BillSearchRow[] = [];

  for (const entry of [...buyerEntries, ...buyerFallback]) {
    const partyId = String(entry.buyerId);
    rows.push({
      id: String(entry._id),
      kind: "buyer",
      partyId,
      partyName: buyerNames.get(partyId) ?? "—",
      type: entry.type,
      billNo: entry.billNo ?? "",
      amountMinor: entry.amountMinor,
      currency: entry.currency as "AFN" | "USD",
      occurredAt: entry.occurredAt,
      note: entry.note ?? "",
      receivedBy: entry.receivedBy ?? "",
    });
  }

  for (const entry of [...supplierEntries, ...supplierFallback]) {
    const partyId = String(entry.supplierId);
    rows.push({
      id: String(entry._id),
      kind: "supplier",
      partyId,
      partyName: supplierNames.get(partyId) ?? "—",
      type: entry.type,
      billNo: entry.billNo ?? "",
      amountMinor: entry.amountMinor,
      currency: entry.currency as "AFN" | "USD",
      occurredAt: entry.occurredAt,
      note: entry.note ?? "",
      receivedBy: entry.receivedBy ?? "",
    });
  }

  // Inventory movements that carry a bill number but whose ledger entry may
  // have been recorded before bill numbers were supported.
  const seen = new Set(rows.map((row) => `${row.kind}:${row.id}`));
  for (const movement of movements) {
    const kind: BillKind = movement.sourceType === INVENTORY_SOURCE_TYPE.PURCHASE ? "supplier" : "buyer";
    const partyId = String(
      movement.sourceType === INVENTORY_SOURCE_TYPE.PURCHASE ? movement.supplierId : movement.buyerId,
    );
    if (!partyId || partyId === "null") continue;
    const key = `${kind}:${String(movement._id)}`;
    if (seen.has(key)) continue;
    rows.push({
      id: String(movement._id),
      kind,
      partyId,
      partyName:
        kind === "supplier" ? supplierNames.get(partyId) ?? "—" : buyerNames.get(partyId) ?? "—",
      type: movement.sourceType,
      billNo: movement.billNo ?? "",
      amountMinor: movement.totalValueMinor,
      currency: movement.currency as "AFN" | "USD",
      occurredAt: movement.occurredAt,
      note: movement.note ?? "",
      receivedBy: "",
    });
  }

  return rows.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
