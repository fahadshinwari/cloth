import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { CURRENCIES } from "../constants";

const clothSchema = new Schema(
  {
    /** Tenant reference — every cloth belongs to exactly one shop. */
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    /** Type/category, e.g. Linen, Cotton, Silk. */
    category: { type: String, trim: true, maxlength: 120, default: "" },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    /** Stock is ALWAYS derived from inventory movements — never stored here. */
    /** Default cost/value PER METER in integer minor units. */
    pricePerMeterMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: CURRENCIES, required: true },
    /** Optional preferred supplier. */
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
    },
    /**
     * Low-stock warning threshold in integer millimeters. When current stock
     * falls at or below this, the cloth appears in low-inventory warnings.
     * Null → no warning for this cloth.
     */
    lowStockThresholdMm: { type: Number, min: 0, default: null },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    /** Audit trail. */
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    collection: "cloths",
  },
);

clothSchema.index({ tenantId: 1, name: 1 });
clothSchema.index({ tenantId: 1, supplierId: 1 });

export type Cloth = InferSchemaType<typeof clothSchema>;

export type ClothDocument = mongoose.HydratedDocument<Cloth>;

export const ClothModel: Model<Cloth> =
  (mongoose.models.Cloth as Model<Cloth>) ||
  mongoose.model<Cloth>("Cloth", clothSchema);
