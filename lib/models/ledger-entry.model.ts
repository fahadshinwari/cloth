import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { CURRENCIES, LEDGER_ENTRY_TYPES } from "../constants";

const ledgerEntrySchema = new Schema(
  {
    /** Tenant reference — denormalized from the buyer for tenant-safe queries. */
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    buyerId: {
      type: Schema.Types.ObjectId,
      ref: "Buyer",
      required: true,
      index: true,
    },
    /** `goods` increases the outstanding balance; `payment` decreases it. */
    type: { type: String, enum: LEDGER_ENTRY_TYPES, required: true },
    /** Integer minor units (see lib/money.ts) — never a float. */
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: CURRENCIES, required: true },
    /** Business date chosen by the merchant. */
    occurredAt: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 2000, default: "" },
    /**
     * Module 4 link: set when this entry was produced by a sale movement
     * (goods given to the buyer). Manually recorded money entries leave it null.
     */
    inventoryMovementId: {
      type: Schema.Types.ObjectId,
      ref: "InventoryMovement",
      default: null,
    },
    /** Who recorded this entry (merchant admin user). */
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "ledger_entries",
  },
);

ledgerEntrySchema.index({ tenantId: 1, buyerId: 1, occurredAt: -1 });
ledgerEntrySchema.index({ tenantId: 1, type: 1, currency: 1 });

export type LedgerEntry = InferSchemaType<typeof ledgerEntrySchema>;

export type LedgerEntryDocument = mongoose.HydratedDocument<LedgerEntry>;

export const LedgerEntryModel: Model<LedgerEntry> =
  (mongoose.models.LedgerEntry as Model<LedgerEntry>) ||
  mongoose.model<LedgerEntry>("LedgerEntry", ledgerEntrySchema);
