import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { CURRENCIES, SUPPLIER_LEDGER_ENTRY_TYPES } from "../constants";

const supplierLedgerEntrySchema = new Schema(
  {
    /** Tenant reference — denormalized from the supplier for tenant-safe queries. */
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    /** `purchase` increases the payable balance; `payment` decreases it. */
    type: { type: String, enum: SUPPLIER_LEDGER_ENTRY_TYPES, required: true },
    /** Integer minor units (see lib/money.ts) — never a float. */
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: CURRENCIES, required: true },
    /** Business date chosen by the merchant. */
    occurredAt: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 2000, default: "" },
    /** Set when this entry was produced by an inventory purchase movement. */
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
    collection: "supplier_ledger_entries",
  },
);

supplierLedgerEntrySchema.index({ tenantId: 1, supplierId: 1, occurredAt: -1 });
supplierLedgerEntrySchema.index({ tenantId: 1, type: 1, currency: 1 });

export type SupplierLedgerEntry = InferSchemaType<typeof supplierLedgerEntrySchema>;

export type SupplierLedgerEntryDocument = mongoose.HydratedDocument<SupplierLedgerEntry>;

export const SupplierLedgerEntryModel: Model<SupplierLedgerEntry> =
  (mongoose.models.SupplierLedgerEntry as Model<SupplierLedgerEntry>) ||
  mongoose.model<SupplierLedgerEntry>("SupplierLedgerEntry", supplierLedgerEntrySchema);
