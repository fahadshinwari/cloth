import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { PARTNER_STATUSES } from "../constants";

export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

const partnerSchema = new Schema(
  {
    /** Tenant reference — every partner belongs to exactly one shop. */
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 40, default: "" },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    status: {
      type: String,
      enum: PARTNER_STATUSES,
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
    collection: "partners",
  },
);

partnerSchema.index({ tenantId: 1, name: 1 });
partnerSchema.index({ tenantId: 1, createdAt: -1 });

export type Partner = InferSchemaType<typeof partnerSchema>;

export type PartnerDocument = mongoose.HydratedDocument<Partner>;

export const PartnerModel: Model<Partner> =
  (mongoose.models.Partner as Model<Partner>) ||
  mongoose.model<Partner>("Partner", partnerSchema);
