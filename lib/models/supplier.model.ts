import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { SUPPLIER_STATUSES } from "../constants";

export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];

const supplierSchema = new Schema(
  {
    /** Tenant reference — every supplier belongs to exactly one shop. */
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    /** Unique, searchable business code (e.g. "SP-1042"). */
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    companyName: { type: String, trim: true, maxlength: 120, default: "" },
    phone: { type: String, trim: true, maxlength: 40, default: "" },
    address: { type: String, trim: true, maxlength: 500, default: "" },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    status: {
      type: String,
      enum: SUPPLIER_STATUSES,
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
    collection: "suppliers",
  },
);

supplierSchema.index({ tenantId: 1, name: 1 });
supplierSchema.index({ tenantId: 1, createdAt: -1 });
// Codes are unique per shop. Partial so legacy rows without a code are ignored.
supplierSchema.index(
  { tenantId: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: "string", $gt: "" } } },
);

/**
 * Dev-only schema refresh: hot reload can keep an old model that silently
 * drops newly added fields such as `code`.
 */
if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.Supplier;
}

export type Supplier = InferSchemaType<typeof supplierSchema>;

export type SupplierDocument = mongoose.HydratedDocument<Supplier>;

export const SupplierModel: Model<Supplier> =
  (mongoose.models.Supplier as Model<Supplier>) ||
  mongoose.model<Supplier>("Supplier", supplierSchema);
