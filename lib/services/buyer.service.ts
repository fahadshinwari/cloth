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
  BuyerModel,
  LedgerEntryModel,
  PaymentReminderModel,
  ShopModel,
  type BuyerDocument,
  type LedgerEntryDocument,
  type PaymentReminderDocument,
} from "../models";
import { connectToDatabase } from "../mongodb";
import { fromMinorUnits, sumByCurrency, toMinorUnits, type CurrencyTotals } from "../money";
import {
  LEDGER_ENTRY_TYPE,
  REMINDER_SCHEDULE,
  type LedgerEntryType,
  type ReminderSchedule,
} from "../constants";
import type { BuyerInput, LedgerEntryInput, PaymentReminderInput } from "../validation";

export class BuyerServiceError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "BuyerServiceError";
    this.field = field;
  }
}

function assertTenantId(tenantId: string): void {
  if (!/^[a-f\d]{24}$/i.test(tenantId)) {
    throw new BuyerServiceError("Invalid tenant.");
  }
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

// ---------------------------------------------------------------------------
// Buyers
// ---------------------------------------------------------------------------

export async function listBuyers(tenantId: string): Promise<BuyerDocument[]> {
  assertTenantId(tenantId);
  await connectToDatabase();
  return BuyerModel.find({ tenantId: toObjectId(tenantId) }).sort({ name: 1 });
}

export async function getBuyerById(
  tenantId: string,
  buyerId: string,
): Promise<BuyerDocument | null> {
  assertTenantId(tenantId);
  if (!/^[a-f\d]{24}$/i.test(buyerId)) return null;
  await connectToDatabase();
  // Tenant filter is always applied — an id alone can never leak another tenant's buyer.
  return BuyerModel.findOne({ _id: toObjectId(buyerId), tenantId: toObjectId(tenantId) });
}

export async function countBuyers(tenantId: string): Promise<number> {
  assertTenantId(tenantId);
  await connectToDatabase();
  return BuyerModel.countDocuments({ tenantId: toObjectId(tenantId) });
}

export async function createBuyer(
  tenantId: string,
  userId: string,
  input: BuyerInput,
): Promise<BuyerDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const duplicate = await BuyerModel.findOne({
    tenantId: toObjectId(tenantId),
    name: input.name,
  });
  if (duplicate) {
    throw new BuyerServiceError("A buyer with this name already exists.", "name");
  }

  return BuyerModel.create({
    tenantId: toObjectId(tenantId),
    name: input.name,
    shopName: input.shopName,
    phone: input.phone,
    address: input.address,
    notes: input.notes,
    status: input.status,
    createdBy: toObjectId(userId),
    updatedBy: toObjectId(userId),
  });
}

export async function updateBuyer(
  tenantId: string,
  buyerId: string,
  userId: string,
  input: BuyerInput,
): Promise<BuyerDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const buyer = await getBuyerById(tenantId, buyerId);
  if (!buyer) throw new BuyerServiceError("Buyer not found.");

  const duplicate = await BuyerModel.findOne({
    tenantId: toObjectId(tenantId),
    name: input.name,
    _id: { $ne: buyer._id },
  });
  if (duplicate) {
    throw new BuyerServiceError("A buyer with this name already exists.", "name");
  }

  buyer.name = input.name;
  buyer.shopName = input.shopName;
  buyer.phone = input.phone;
  buyer.address = input.address;
  buyer.notes = input.notes;
  buyer.status = input.status;
  buyer.updatedBy = toObjectId(userId);
  await buyer.save();
  return buyer;
}

// ---------------------------------------------------------------------------
// Ledger — the outstanding balance is ALWAYS derived from entries, never stored
// ---------------------------------------------------------------------------

export async function listLedgerEntries(
  tenantId: string,
  buyerId?: string,
): Promise<LedgerEntryDocument[]> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const query: Record<string, unknown> = { tenantId: toObjectId(tenantId) };
  if (buyerId) {
    if (!/^[a-f\d]{24}$/i.test(buyerId)) return [];
    query.buyerId = toObjectId(buyerId);
  }

  // Chronological so partial payments replay in the right order.
  return LedgerEntryModel.find(query).sort({ occurredAt: 1, createdAt: 1 });
}

/**
 * Maps buyer entries onto the shared ledger engine.
 * Semantics: Debit = goods given (owe more), Credit = payment received (owe less).
 */
export function toBuyerLedgerEntries(entries: LedgerEntryDocument[]): RawLedgerEntry[] {
  return entries.map((entry) => ({
    id: String(entry._id),
    date: entry.occurredAt,
    description: entry.note || (entry.type === LEDGER_ENTRY_TYPE.GOODS ? "Clothes given" : "Payment received"),
    debitMinor: entry.type === LEDGER_ENTRY_TYPE.GOODS ? entry.amountMinor : 0,
    creditMinor: entry.type === LEDGER_ENTRY_TYPE.PAYMENT ? entry.amountMinor : 0,
    currency: entry.currency as "AFN" | "USD",
    type: entry.type,
    source: entry.inventoryMovementId ? "sale" : "manual",
  }));
}

/** Filterable ledger view for one buyer (uses the shared engine). */
export async function getBuyerLedgerView(
  tenantId: string,
  buyerId: string,
  filters: LedgerFilters = {},
): Promise<LedgerView> {
  const entries = await listLedgerEntries(tenantId, buyerId);
  return buildLedgerView(toBuyerLedgerEntries(entries), LEDGER_SEMANTICS.buyer, filters);
}

export async function createLedgerEntry(
  tenantId: string,
  userId: string,
  input: LedgerEntryInput,
): Promise<LedgerEntryDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();

  // The buyer MUST belong to the same tenant.
  const buyer = await getBuyerById(tenantId, input.buyerId);
 if (!buyer) {
    throw new BuyerServiceError("Buyer not found.", "buyerId");
  }

  const amountMinor = toMinorUnits(input.amount, input.currency);
  if (amountMinor === null || amountMinor <= 0) {
    throw new BuyerServiceError("Invalid ledger amount.", "amount");
  }

  // Overpayment guard: a payment must not exceed the buyer's current
  // outstanding for that currency, unless the tenant allows advances.
  if (input.type === LEDGER_ENTRY_TYPE.PAYMENT) {
    const shop = await ShopModel.findById(tenantId).select("allowAdvancePayments").lean();
    if (!shop?.allowAdvancePayments) {
      const totals = await getBuyerLedgerTotals(tenantId, String(buyer._id));
      const outstanding = totals.outstanding[input.currency as "AFN" | "USD"];
      if (amountMinor > outstanding) {
        throw new BuyerServiceError(
          `Payment exceeds outstanding balance.`,
          "amount",
        );
      }
    }
  }

  return LedgerEntryModel.create({
    tenantId: toObjectId(tenantId),
    buyerId: buyer._id,
    type: input.type,
    amountMinor,
    currency: input.currency,
    occurredAt: input.occurredAt,
    note: input.note,
    createdBy: toObjectId(userId),
  });
}

/**
 * Deletes a MANUAL ledger entry. Entries linked to an inventory movement are
 * part of an atomic business transaction (stock + money) and must never be
 * deleted alone — correcting them requires a reversing entry, so history is
 * preserved. Silent overwrites of financial history are not allowed.
 */
export async function deleteLedgerEntry(
  tenantId: string,
  entryId: string,
): Promise<void> {
  assertTenantId(tenantId);
  if (!/^[a-f\d]{24}$/i.test(entryId)) return;
  await connectToDatabase();

  const entry = await LedgerEntryModel.findOne({
    _id: toObjectId(entryId),
    tenantId: toObjectId(tenantId),
  });
  if (!entry) return;
  if (entry.inventoryMovementId) {
    throw new BuyerServiceError(
      "This entry is part of an inventory transaction and cannot be deleted. Record a reversing sale/purchase or an adjustment instead.",
    );
  }
  await LedgerEntryModel.deleteOne({ _id: entry._id });
}

// ---------------------------------------------------------------------------
// Aggregations — per buyer and grand totals, always per currency
// ---------------------------------------------------------------------------

export interface MoneyTotals extends CurrencyTotals {
  /** Decimal amounts ready for display, keyed by currency. */
  display: Record<"AFN" | "USD", number>;
}

function toTotals(entries: Array<{ currency: "AFN" | "USD"; amountMinor: number }>): MoneyTotals {
  const totals = sumByCurrency(entries);
  return {
    ...totals,
    display: {
      AFN: fromMinorUnits(totals.AFN, "AFN"),
      USD: fromMinorUnits(totals.USD, "USD"),
    },
  };
}

export interface LedgerTotals {
  goods: MoneyTotals;
  payments: MoneyTotals;
  /** goods − payments, per currency (can be negative if overpaid). */
  outstanding: MoneyTotals;
}

async function aggregateTotals(
  tenantId: string,
  match: Record<string, unknown>,
): Promise<LedgerTotals> {
  const rows = await LedgerEntryModel.aggregate<{
    _id: { type: LedgerEntryType; currency: "AFN" | "USD" };
    total: number;
  }>([
    { $match: { tenantId: toObjectId(tenantId), ...match } },
    { $group: { _id: { type: "$type", currency: "$currency" }, total: { $sum: "$amountMinor" } } },
  ]);

  const goods: Array<{ currency: "AFN" | "USD"; amountMinor: number }> = [];
  const payments: Array<{ currency: "AFN" | "USD"; amountMinor: number }> = [];

  for (const row of rows) {
    const bucket = row._id.type === LEDGER_ENTRY_TYPE.GOODS ? goods : payments;
    bucket.push({ currency: row._id.currency, amountMinor: row.total });
  }

  const goodsTotals = toTotals(goods);
  const paymentsTotals = toTotals(payments);

  return {
    goods: goodsTotals,
    payments: paymentsTotals,
    outstanding: {
      AFN: goodsTotals.AFN - paymentsTotals.AFN,
      USD: goodsTotals.USD - paymentsTotals.USD,
      display: {
        AFN: fromMinorUnits(goodsTotals.AFN - paymentsTotals.AFN, "AFN"),
        USD: fromMinorUnits(goodsTotals.USD - paymentsTotals.USD, "USD"),
      },
    },
  };
}

/** Totals for one buyer (still tenant-filtered). */
export async function getBuyerLedgerTotals(
  tenantId: string,
  buyerId: string,
): Promise<LedgerTotals> {
  assertTenantId(tenantId);
  await connectToDatabase();
  return aggregateTotals(tenantId, { buyerId: toObjectId(buyerId) });
}

/** Totals for ALL buyers of the tenant, plus a per-buyer breakdown. */
export interface BuyerWithTotals {
  buyer: BuyerDocument;
  totals: LedgerTotals;
}

export async function getBuyersWithLedgerTotals(
  tenantId: string,
): Promise<{ overall: LedgerTotals; buyers: BuyerWithTotals[] }> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const [buyers, rows] = await Promise.all([
    listBuyers(tenantId),
    LedgerEntryModel.aggregate<{
      _id: { buyerId: mongoose.Types.ObjectId; type: LedgerEntryType; currency: "AFN" | "USD" };
      total: number;
    }>([
      { $match: { tenantId: toObjectId(tenantId) } },
      {
        $group: {
          _id: { buyerId: "$buyerId", type: "$type", currency: "$currency" },
          total: { $sum: "$amountMinor" },
        },
      },
    ]),
  ]);

  const byBuyer = new Map<string, Array<{ currency: "AFN" | "USD"; amountMinor: number; type: LedgerEntryType }>>();
  for (const row of rows) {
    const key = row._id.buyerId.toString();
    const list = byBuyer.get(key) ?? [];
    list.push({ currency: row._id.currency, amountMinor: row.total, type: row._id.type });
    byBuyer.set(key, list);
  }

  const buyersWithTotals: BuyerWithTotals[] = buyers.map((buyer) => {
    const entries = byBuyer.get(String(buyer._id)) ?? [];
    const goods = entries.filter((e) => e.type === LEDGER_ENTRY_TYPE.GOODS);
    const payments = entries.filter((e) => e.type === LEDGER_ENTRY_TYPE.PAYMENT);

    const goodsTotals = toTotals(goods);
    const paymentsTotals = toTotals(payments);

    return {
      buyer,
      totals: {
        goods: goodsTotals,
        payments: paymentsTotals,
        outstanding: {
          AFN: goodsTotals.AFN - paymentsTotals.AFN,
          USD: goodsTotals.USD - paymentsTotals.USD,
          display: {
            AFN: fromMinorUnits(goodsTotals.AFN - paymentsTotals.AFN, "AFN"),
            USD: fromMinorUnits(goodsTotals.USD - paymentsTotals.USD, "USD"),
          },
        },
      },
    };
  });

  // Grand totals come from a fresh aggregation over the whole tenant so they
  // can never disagree with the underlying ledger entries.
  const overall = await aggregateTotals(tenantId, {});

  return { overall, buyers: buyersWithTotals };
}

// ---------------------------------------------------------------------------
// Payment reminders — INFORMATIONAL ONLY
// These never create ledger entries and never touch balances.
// ---------------------------------------------------------------------------

export async function listReminders(
  tenantId: string,
  opts: { buyerId?: string; activeOnly?: boolean } = {},
): Promise<PaymentReminderDocument[]> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const query: Record<string, unknown> = { tenantId: toObjectId(tenantId) };
  if (opts.buyerId) {
    if (!/^[a-f\d]{24}$/i.test(opts.buyerId)) return [];
    query.buyerId = toObjectId(opts.buyerId);
  }
  if (opts.activeOnly) query.active = true;

  return PaymentReminderModel.find(query).sort({ createdAt: -1 });
}

export async function createReminder(
  tenantId: string,
  input: PaymentReminderInput,
): Promise<PaymentReminderDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const buyer = await getBuyerById(tenantId, input.buyerId);
  if (!buyer) {
    throw new BuyerServiceError("Buyer not found.", "buyerId");
  }

  return PaymentReminderModel.create({
    tenantId: toObjectId(tenantId),
    buyerId: buyer._id,
    schedule: input.schedule as ReminderSchedule,
    weekday: input.schedule === REMINDER_SCHEDULE.WEEKLY ? input.weekday : null,
    dueDate: input.schedule === REMINDER_SCHEDULE.DATE ? input.dueDate : null,
    amountMinor: input.amountMinor,
    currency: input.currency,
    note: input.note,
    active: input.active,
  });
}

export async function setReminderActive(
  tenantId: string,
  reminderId: string,
  active: boolean,
): Promise<void> {
  assertTenantId(tenantId);
  if (!/^[a-f\d]{24}$/i.test(reminderId)) return;
  await connectToDatabase();
  await PaymentReminderModel.updateOne(
    { _id: toObjectId(reminderId), tenantId: toObjectId(tenantId) },
    { $set: { active } },
  );
}

export async function deleteReminder(tenantId: string, reminderId: string): Promise<void> {
  assertTenantId(tenantId);
  if (!/^[a-f\d]{24}$/i.test(reminderId)) return;
  await connectToDatabase();
  await PaymentReminderModel.deleteOne({
    _id: toObjectId(reminderId),
    tenantId: toObjectId(tenantId),
  });
}

/**
 * Computes the display state of a reminder relative to "now".
 * Weekly reminders show the next occurrence; dated reminders show
 * upcoming / due-today / overdue. Pure presentation logic — it never
 * creates payments and never mutates a ledger.
 */
export interface ReminderView {
  reminder: PaymentReminderDocument;
  buyerName: string;
  /** ISO date (yyyy-mm-dd) of the next expected collection. */
  nextDate: string | null;
  /** "overdue" | "today" | "soon" (≤ 7 days) | "upcoming". */
  state: "overdue" | "today" | "soon" | "upcoming";
}

export function buildReminderViews(
  reminders: PaymentReminderDocument[],
  buyerNames: Map<string, string>,
  now: Date = new Date(),
): ReminderView[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const views: ReminderView[] = reminders.map((reminder) => {
    const buyerName =
      buyerNames.get(String(reminder.buyerId)) ?? "Unknown buyer";

    let nextDate: string | null = null;
    let state: ReminderView["state"] = "upcoming";

    if (reminder.schedule === REMINDER_SCHEDULE.WEEKLY && reminder.weekday != null) {
      // Next occurrence of the weekday, today included.
      const target = new Date(startOfToday);
      const diff = (reminder.weekday - target.getDay() + 7) % 7;
      target.setDate(target.getDate() + diff);
      nextDate = target.toISOString().slice(0, 10);
      state = diff === 0 ? "today" : "upcoming";
    } else if (reminder.schedule === REMINDER_SCHEDULE.DATE && reminder.dueDate) {
      const due = new Date(reminder.dueDate);
      const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      const days = Math.round((dueStart.getTime() - startOfToday.getTime()) / 86_400_000);
      nextDate = dueStart.toISOString().slice(0, 10);
      state = days < 0 ? "overdue" : days === 0 ? "today" : days <= 7 ? "soon" : "upcoming";
    }

    return { reminder, buyerName, nextDate, state };
  });

  // Overdue and due-today first, then soonest date.
  const order: Record<ReminderView["state"], number> = {
    overdue: 0,
    today: 1,
    soon: 2,
    upcoming: 3,
  };
  return views.sort((a, b) => {
    if (order[a.state] !== order[b.state]) return order[a.state] - order[b.state];
    return (a.nextDate ?? "").localeCompare(b.nextDate ?? "");
  });
}
