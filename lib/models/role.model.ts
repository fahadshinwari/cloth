import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Shop-scoped role. Permissions are module-level capabilities from
 * lib/constants.ts. The built-in "owner" role always carries every
 * permission and is never deletable.
 */
const roleSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    /** Stable machine key, unique per shop (e.g. "manager"). */
    key: { type: String, required: true, trim: true, lowercase: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    /** Module permissions granted to this role. */
    permissions: { type: [String], default: [] },
    /** System roles (owner) cannot be deleted. */
    isSystem: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    collection: "roles",
  },
);

roleSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export type Role = InferSchemaType<typeof roleSchema>;

export type RoleDocument = mongoose.HydratedDocument<Role>;

if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.Role;
}

export const RoleModel: Model<Role> =
  (mongoose.models.Role as Model<Role>) || mongoose.model<Role>("Role", roleSchema);
