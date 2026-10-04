import "server-only";

import mongoose from "mongoose";
import {
  TellerTransactionModel,
  type TellerTransactionDocument,
} from "../models";
import { connectToDatabase } from "../mongodb";
import { toMinorUnits } from "../money";
import { TELLER_TRANSACTION_TYPE } from "../constants";
import type { TellerTransactionInput } from "../validation";
import {
  buildLedgerView,
  LEDGER_SEMANTICS,
  type LedgerFilters,
  type LedgerView,
  type RawLedgerEntry,
} from "../ledger";

export class TellerServiceError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "TellerServiceError";
    this.field = field;
  }
}

function assertTenantId(tenantId: string): void {
  if (!/^[a-f\d]{24}$/i.test(tenantId)) {
    throw new TellerServiceError("Invalid tenant.");
  }
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

// ---------------------------------------------------------------------------
// Transactions — append-only; the balance is always derived, never stored
// ---------------------------------------------------------------------------

export async function listTellerTransactions(
  tenantId: string,
): Promise<TellerTransactionDocument[]> {
  assertTenantId(tenantId);
  await connectToDatabase();
  return TellerTransactionModel.find({ tenantId: toObjectId(tenantId) }).sort({
    occurredAt: 1,
    createdAt: 1,
  });
}

/**
 * Records a manual cash movement:
 * `add`    → cash with the teller increases,
 * `remove` → cash with the teller decreases.
 * The merchant performs these by hand — no other module writes here.
 */
export async function createTellerTransaction(
  tenantId: string,
  userId: string,
  input: TellerTransactionInput,
): Promise<TellerTransactionDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const amountMinor = toMinorUnits(input.amount, input.currency);
  if (amountMinor === null || amountMinor <= 0) {
    throw new TellerServiceError("Invalid amount.", "amount");
  }

  return TellerTransactionModel.create({
    tenantId: toObjectId(tenantId),
    type: input.type,
    amountMinor,
    currency: input.currency,
    occurredAt: input.occurredAt,
    note: input.note,
    createdBy: toObjectId(userId),
  });
}

// ---------------------------------------------------------------------------
// Derived balance + ledger view (per currency, never merged)
// ---------------------------------------------------------------------------

export interface TellerBalance {
  AFN: number;
  USD: number;
  display: Record<"AFN" | "USD", number>;
}

/** Current cash on hand across all transactions, per currency. */
export async function getTellerBalance(tenantId: string): Promise<TellerBalance> {
  const transactions = await listTellerTransactions(tenantId);

  const totals: Record<"AFN" | "USD", number> = { AFN: 0, USD: 0 };
  for (const tx of transactions) {
    if (tx.type === TELLER_TRANSACTION_TYPE.ADD) {
      totals[tx.currency as "AFN" | "USD"] += tx.amountMinor;
    } else {
      totals[tx.currency as "AFN" | "USD"] -= tx.amountMinor;
    }
  }

  return {
    AFN: totals.AFN,
    USD: totals.USD,
    display: {
      AFN: totals.AFN / 100,
      USD: totals.USD / 100,
    },
  };
}

/**
 * Maps teller transactions onto the shared ledger engine.
 * Semantics: Debit = cash in (ADD), Credit = cash out (REMOVE),
 * so balance = Σ debits − Σ credits = cash on hand.
 */
export function toTellerLedgerEntries(
  transactions: TellerTransactionDocument[],
): RawLedgerEntry[] {
  return transactions.map((tx) => ({
    id: String(tx._id),
    date: tx.occurredAt,
    description: tx.note || (tx.type === TELLER_TRANSACTION_TYPE.ADD ? "Cash added" : "Cash removed"),
    debitMinor: tx.type === TELLER_TRANSACTION_TYPE.ADD ? tx.amountMinor : 0,
    creditMinor: tx.type === TELLER_TRANSACTION_TYPE.REMOVE ? tx.amountMinor : 0,
    currency: tx.currency as "AFN" | "USD",
    type: tx.type,
    source: "teller",
  }));
}

/** Filterable ledger view for the teller page (uses the shared engine). */
export async function getTellerLedgerView(
  tenantId: string,
  filters: LedgerFilters = {},
): Promise<LedgerView> {
  const transactions = await listTellerTransactions(tenantId);
  return buildLedgerView(toTellerLedgerEntries(transactions), LEDGER_SEMANTICS.teller, filters);
}
