import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { CURRENCIES, INVENTORY_DIRECTIONS, INVENTORY_SOURCE_TYPES } from "../constants";

const inventoryMovementSchema = new Schema(
  {
    /** Tenant reference — every movement belongs to exactly one shop. */
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    clothId: {
      type: Schema.Types.ObjectId,
      ref: "Cloth",
      required: true,
      index: true,
    },
    /** `in` → stock increases (received); `out` → stock decreases (given/sold). */
    direction: { type: String, enum: INVENTORY_DIRECTIONS, required: true },
    /** Quantity in integer millimeters of cloth (see lib/measure.ts). */
    quantityMm: { type: Number, required: true, min: 1 },
    /** Price per meter in integer minor units, for THIS movement. */
    pricePerMeterMinor: { type: Number, required: true, min: 1 },
    /** Derived: quantityMm / 1000 × pricePerMeterMinor — exact integer math. */
    totalValueMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: CURRENCIES, required: true },
    /** `purchase` (from supplier) | `sale` (to buyer) | `adjustment`. */
    sourceType: { type: String, enum: INVENTORY_SOURCE_TYPES, required: true },
    /** The party on the other side of the transaction. */
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", default: null },
    buyerId: { type: Schema.Types.ObjectId, ref: "Buyer", default: null },
    /** Business date chosen by the merchant. */
    occurredAt: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 2000, default: "" },
    /** Who recorded this movement (merchant admin user). */
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "inventory_movements",
  },
);

inventoryMovementSchema.index({ tenantId: 1, clothId: 1, occurredAt: -1 });
inventoryMovementSchema.index({ tenantId: 1, sourceType: 1 });
inventoryMovementSchema.index({ tenantId: 1, supplierId: 1 });
inventoryMovementSchema.index({ tenantId: 1, buyerId: 1 });

export type InventoryMovement = InferSchemaType<typeof inventoryMovementSchema>;

export type InventoryMovementDocument = mongoose.HydratedDocument<InventoryMovement>;

export const InventoryMovementModel: Model<InventoryMovement> =
  (mongoose.models.InventoryMovement as Model<InventoryMovement>) ||
  mongoose.model<InventoryMovement>("InventoryMovement", inventoryMovementSchema);
