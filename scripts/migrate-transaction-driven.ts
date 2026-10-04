/**
 * Migration: transaction-driven architecture audit + safe backfill.
 *
 * 1. AUDIT — verifies no tenant stores computed balances/quantities:
 *    buyer/supplier/partner/cloth documents must not carry balance-like or
 *    stock-like fields. Reports any suspicious fields (informational).
 *
 * 2. BACKFILL — for historical inventory movements with sourceType
 *    purchase/sale that are missing their goods/purchase ledger entry
 *    (the pre-fix flow skipped it when fully paid), create the missing
 *    ledger side. Payment entries are NOT created or changed — only the
 *    missing goods/purchase record, so balances become correct without
 *    inventing payment history.
 *
 * Idempotent: re-running finds nothing to do. No documents are deleted.
 *
 * Usage: NODE_OPTIONS="--require ./scripts/stub-server-only.cjs" npx tsx scripts/migrate-transaction-driven.ts
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2];
    }
  }
}

async function main() {
  const { connectToDatabase } = await import("../lib/mongodb");
  const {
    InventoryMovementModel,
    LedgerEntryModel,
    SupplierLedgerEntryModel,
  } = await import("../lib/models");
  await connectToDatabase();

  console.log("== Transaction-driven architecture audit ==\n");

  // ---- 1. Audit for stored derived fields -------------------------------
  const suspicious: string[] = [];
  const collections: Array<[string, string[]]> = [
    ["buyers", ["balance", "outstanding", "totalGoods", "totalPayments"]],
    ["suppliers", ["balance", "payable", "totalPurchases", "totalPayments"]],
    ["partners", ["totalInvested", "balance"]],
    ["cloths", ["currentQuantity", "stockMm", "quantity"]],
  ];
  for (const [name, fields] of collections) {
    const collection = mongoose.connection.collection(name);
    const sample = await collection.findOne({ $or: fields.map((f) => ({ [f]: { $exists: true } })) });
    if (sample) {
      suspicious.push(`${name}: found stored derived field(s) ${fields.join(", ")}`);
    }
  }
  if (suspicious.length === 0) {
    console.log("Audit OK: no stored balances/quantities found — all values derived from transactions.");
  } else {
    console.log("AUDIT WARNINGS:");
    for (const line of suspicious) console.log(`  - ${line}`);
  }

  // ---- 2. Backfill missing ledger sides --------------------------------
  let backfilled = 0;
  let skipped = 0;

  const movements = await InventoryMovementModel.find({
    sourceType: { $in: ["purchase", "sale"] },
  }).lean();

  for (const movement of movements) {
    const tenantId = movement.tenantId;
    const movementId = movement._id;

    if (movement.sourceType === "purchase") {
      const existing = await SupplierLedgerEntryModel.findOne({
        tenantId,
        inventoryMovementId: movementId,
        type: "purchase",
      }).lean();
      if (existing) continue;

      await SupplierLedgerEntryModel.create({
        tenantId,
        supplierId: movement.supplierId as mongoose.Types.ObjectId,
        type: "purchase",
        amountMinor: movement.totalValueMinor,
        currency: movement.currency,
        occurredAt: movement.occurredAt,
        note: movement.note || `Backfilled purchase: ${movement.quantityMm / 1000} m`,
        inventoryMovementId: movementId,
        createdBy: movement.createdBy,
      });
      backfilled += 1;
    } else {
      const existing = await LedgerEntryModel.findOne({
        tenantId,
        inventoryMovementId: movementId,
        type: "goods",
      }).lean();
      if (existing) {
        skipped += 1;
        continue;
      }

      await LedgerEntryModel.create({
        tenantId,
        buyerId: movement.buyerId as mongoose.Types.ObjectId,
        type: "goods",
        amountMinor: movement.totalValueMinor,
        currency: movement.currency,
        occurredAt: movement.occurredAt,
        note: movement.note || `Backfilled sale: ${movement.quantityMm / 1000} m`,
        inventoryMovementId: movementId,
        createdBy: movement.createdBy,
      });
      backfilled += 1;
    }
  }

  console.log(`\nBackfill complete: ${backfilled} missing ledger side(s) created, ${skipped} skipped.`);
  console.log("Payment history was NOT modified. Re-run to verify idempotency.");
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
