import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { CURRENCIES } from "../constants";

const investmentSchema = new Schema(
  {
    /** Tenant reference — denormalized from the partner for tenant-safe queries. */
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    partnerId: {
      type: Schema.Types.ObjectId,
      ref: "Partner",
      required: true,
      index: true,
    },
    /** Integer minor units (see lib/money.ts) — never a float. */
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: CURRENCIES, required: true },
    /** Business date chosen by the merchant (may differ from createdAt). */
    investedAt: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 2000, default: "" },
    /** Who recorded this investment (merchant admin user). */
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "investments",
  },
);

investmentSchema.index({ tenantId: 1, partnerId: 1, investedAt: -1 });
investmentSchema.index({ tenantId: 1, currency: 1 });
investmentSchema.index({ tenantId: 1, investedAt: -1 });

export type Investment = InferSchemaType<typeof investmentSchema>;

export type InvestmentDocument = mongoose.HydratedDocument<Investment>;

export const InvestmentModel: Model<Investment> =
  (mongoose.models.Investment as Model<Investment>) ||
  mongoose.model<Investment>("Investment", investmentSchema);
