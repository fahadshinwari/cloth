import "server-only";

import mongoose from "mongoose";
import {
  InvestmentModel,
  PartnerModel,
  type InvestmentDocument,
  type PartnerDocument,
} from "../models";
import { connectToDatabase } from "../mongodb";
import { fromMinorUnits, sumByCurrency, toMinorUnits, type CurrencyTotals } from "../money";
import type { InvestmentInput, PartnerInput } from "../validation";

export class PartnerServiceError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "PartnerServiceError";
    this.field = field;
  }
}

function assertTenantId(tenantId: string): void {
  if (!/^[a-f\d]{24}$/i.test(tenantId)) {
    throw new PartnerServiceError("Invalid tenant.");
  }
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

// ---------------------------------------------------------------------------
// Partners
// ---------------------------------------------------------------------------

export async function listPartners(tenantId: string): Promise<PartnerDocument[]> {
  assertTenantId(tenantId);
  await connectToDatabase();
  return PartnerModel.find({ tenantId: new mongoose.Types.ObjectId(tenantId) }).sort({ name: 1 });
}

export async function getPartnerById(
  tenantId: string,
  partnerId: string,
): Promise<PartnerDocument | null> {
  assertTenantId(tenantId);
  if (!/^[a-f\d]{24}$/i.test(partnerId)) return null;
  await connectToDatabase();
  // Tenant filter is always applied — an id alone can never leak another tenant's partner.
  return PartnerModel.findOne({
    _id: new mongoose.Types.ObjectId(partnerId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
  });
}

export async function countPartners(tenantId: string): Promise<number> {
  assertTenantId(tenantId);
  await connectToDatabase();
  return PartnerModel.countDocuments({ tenantId: new mongoose.Types.ObjectId(tenantId) });
}

export async function createPartner(
  tenantId: string,
  userId: string,
  input: PartnerInput,
): Promise<PartnerDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const duplicate = await PartnerModel.findOne({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    name: input.name,
  });
  if (duplicate) {
    throw new PartnerServiceError("A partner with this name already exists.", "name");
  }

  return PartnerModel.create({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    name: input.name,
    phone: input.phone,
    notes: input.notes,
    status: input.status,
    createdBy: toObjectId(userId),
    updatedBy: toObjectId(userId),
  });
}

export async function updatePartner(
  tenantId: string,
  partnerId: string,
  userId: string,
  input: PartnerInput,
): Promise<PartnerDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const partner = await getPartnerById(tenantId, partnerId);
  if (!partner) throw new PartnerServiceError("Partner not found.");

  const duplicate = await PartnerModel.findOne({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    name: input.name,
    _id: { $ne: partner._id },
  });
  if (duplicate) {
    throw new PartnerServiceError("A partner with this name already exists.", "name");
  }

  partner.name = input.name;
  partner.phone = input.phone;
  partner.notes = input.notes;
  partner.status = input.status;
  partner.updatedBy = toObjectId(userId);
  await partner.save();
  return partner;
}

// ---------------------------------------------------------------------------
// Investments (append-only history — old records are never overwritten)
// ---------------------------------------------------------------------------

export async function listInvestments(
  tenantId: string,
  partnerId?: string,
): Promise<InvestmentDocument[]> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const query: Record<string, unknown> = { tenantId: new mongoose.Types.ObjectId(tenantId) };
  if (partnerId) {
    if (!/^[a-f\d]{24}$/i.test(partnerId)) return [];
    query.partnerId = new mongoose.Types.ObjectId(partnerId);
  }

  return InvestmentModel.find(query).sort({ investedAt: -1, createdAt: -1 });
}

export async function createInvestment(
  tenantId: string,
  userId: string,
  input: InvestmentInput,
): Promise<InvestmentDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();

  // The partner MUST belong to the same tenant.
  const partner = await getPartnerById(tenantId, input.partnerId);
  if (!partner) {
    throw new PartnerServiceError("Partner not found.", "partnerId");
  }

  const amountMinor = toMinorUnits(input.amount, input.currency);
  if (amountMinor === null || amountMinor <= 0) {
    throw new PartnerServiceError("Invalid investment amount.", "amount");
  }

  return InvestmentModel.create({
    tenantId: new mongoose.Types.ObjectId(tenantId),
    partnerId: partner._id,
    amountMinor,
    currency: input.currency,
    investedAt: input.investedAt,
    note: input.note,
    createdBy: new mongoose.Types.ObjectId(userId),
  });
}

export async function deleteInvestment(
  tenantId: string,
  investmentId: string,
): Promise<void> {
  assertTenantId(tenantId);
  if (!/^[a-f\d]{24}$/i.test(investmentId)) return;
  await connectToDatabase();
  await InvestmentModel.deleteOne({
    _id: new mongoose.Types.ObjectId(investmentId),
    tenantId: new mongoose.Types.ObjectId(tenantId),
  });
}

// ---------------------------------------------------------------------------
// Aggregations — always per currency, never merged
// ---------------------------------------------------------------------------

export interface InvestmentTotals extends CurrencyTotals {
  /** Decimal amounts ready for display, keyed by currency. */
  display: Record<"AFN" | "USD", number>;
}

function toTotals(entries: Array<{ currency: "AFN" | "USD"; amountMinor: number }>): InvestmentTotals {
  const totals = sumByCurrency(entries);
  return {
    ...totals,
    display: {
      AFN: fromMinorUnits(totals.AFN, "AFN"),
      USD: fromMinorUnits(totals.USD, "USD"),
    },
  };
}

export async function getPartnerInvestmentTotals(
  tenantId: string,
): Promise<Map<string, InvestmentTotals>> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const rows = await InvestmentModel.aggregate<{
    _id: { partnerId: mongoose.Types.ObjectId; currency: "AFN" | "USD" };
    total: number;
  }>([
    { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
    { $group: { _id: { partnerId: "$partnerId", currency: "$currency" }, total: { $sum: "$amountMinor" } } },
  ]);

  const byPartner = new Map<string, Array<{ currency: "AFN" | "USD"; amountMinor: number }>>();
  for (const row of rows) {
    const key = row._id.partnerId.toString();
    const list = byPartner.get(key) ?? [];
    list.push({ currency: row._id.currency, amountMinor: row.total });
    byPartner.set(key, list);
  }

  const result = new Map<string, InvestmentTotals>();
  for (const [partnerId, entries] of byPartner) {
    result.set(partnerId, toTotals(entries));
  }
  return result;
}

export async function getInvestmentGrandTotals(tenantId: string): Promise<InvestmentTotals> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const rows = await InvestmentModel.aggregate<{
    _id: "AFN" | "USD";
    total: number;
  }>([
    { $match: { tenantId: new mongoose.Types.ObjectId(tenantId) } },
    { $group: { _id: "$currency", total: { $sum: "$amountMinor" } } },
  ]);

  return toTotals(
    rows.map((row) => ({ currency: row._id, amountMinor: row.total })),
  );
}
