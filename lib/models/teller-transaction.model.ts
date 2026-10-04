import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { CURRENCIES, TELLER_TRANSACTION_TYPES } from "../constants";

const tellerTransactionSchema = new Schema(
  {
    /** Tenant reference — every teller transaction belongs to exactly one shop. */
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    /** `add` → cash with teller increases; `remove` → decreases. */
    type: { type: String, enum: TELLER_TRANSACTION_TYPES, required: true },
    /** Integer minor units (see lib/money.ts) — never a float. */
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: CURRENCIES, required: true },
    /** Business date chosen by the merchant. */
    occurredAt: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 2000, default: "" },
    /** Who recorded this transaction (merchant admin user) — audit trail. */
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "teller_transactions",
  },
);

tellerTransactionSchema.index({ tenantId: 1, occurredAt: -1 });
tellerTransactionSchema.index({ tenantId: 1, type: 1, currency: 1 });

export type TellerTransaction = InferSchemaType<typeof tellerTransactionSchema>;

export type TellerTransactionDocument = mongoose.HydratedDocument<TellerTransaction>;

export const TellerTransactionModel: Model<TellerTransaction> =
  (mongoose.models.TellerTransaction as Model<TellerTransaction>) ||
  mongoose.model<TellerTransaction>("TellerTransaction", tellerTransactionSchema);
