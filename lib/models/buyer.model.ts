import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { BUYER_STATUSES } from "../constants";

export type BuyerStatus = (typeof BUYER_STATUSES)[number];

const buyerSchema = new Schema(
  {
    /** Tenant reference — every buyer belongs to exactly one shop. */
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    shopName: { type: String, trim: true, maxlength: 120, default: "" },
    phone: { type: String, trim: true, maxlength: 40, default: "" },
    address: { type: String, trim: true, maxlength: 500, default: "" },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    status: {
      type: String,
      enum: BUYER_STATUSES,
      required: true,
      default: "active",
      index: true,
    },
    /** Audit trail. */
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    collection: "buyers",
  },
);

buyerSchema.index({ tenantId: 1, name: 1 });
buyerSchema.index({ tenantId: 1, createdAt: -1 });

export type Buyer = InferSchemaType<typeof buyerSchema>;

export type BuyerDocument = mongoose.HydratedDocument<Buyer>;

export const BuyerModel: Model<Buyer> =
  (mongoose.models.Buyer as Model<Buyer>) ||
  mongoose.model<Buyer>("Buyer", buyerSchema);
