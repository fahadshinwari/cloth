import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { SHOP_STATUSES } from "../constants";

export type ShopStatus = (typeof SHOP_STATUSES)[number];

const shopSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    adminName: { type: String, required: true, trim: true },
    adminEmail: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    adminPasswordHash: { type: String, required: true, select: false },
    phone: { type: String, required: true, trim: true },
    currency: { type: String, enum: ["AFN", "USD"], required: true, default: "AFN" },
    status: { type: String, enum: SHOP_STATUSES, required: true, default: "active" },
    /**
     * Module 4: when false (default) inventory movements that would drive a
     * cloth's stock below zero are rejected. Only the platform administrator
     * may flip this — it is an explicit merchant-wide escape hatch.
     */
    allowNegativeInventory: { type: Boolean, required: true, default: false },
    /**
     * When false (default), payments exceeding the counterparty's outstanding
     * balance are rejected. Advance payments require an explicit admin opt-in.
     */
    allowAdvancePayments: { type: Boolean, required: true, default: false },
  },
  {
    timestamps: true,
    collection: "tenants",
  },
);

export type Shop = InferSchemaType<typeof shopSchema>;

export type ShopDocument = mongoose.HydratedDocument<Shop>;

export const ShopModel: Model<Shop> =
  (mongoose.models.Tenant as Model<Shop>) ||
  mongoose.model<Shop>("Tenant", shopSchema);
