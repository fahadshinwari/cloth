import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { USER_ROLES } from "../constants";

export type UserRole = (typeof USER_ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true },
    /**
     * Shop role key (see RoleModel). Legacy shop admins without this field
     * are treated as "owner" so they keep full access.
     */
    roleKey: { type: String, trim: true, lowercase: true, default: "owner" },
    /**
     * Tenant reference — only set for `merchant_admin` users.
     * The tenant of a request is ALWAYS derived from the session token,
     * never from any client-supplied value.
     */
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    collection: "users",
  },
);

userSchema.index({ role: 1, tenantId: 1 });

/** Dev-only schema refresh — hot reload can drop newly added fields. */
if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.User;
}

export type User = InferSchemaType<typeof userSchema>;

export type UserDocument = mongoose.HydratedDocument<User>;

export const UserModel: Model<User> =
  (mongoose.models.User as Model<User>) || mongoose.model<User>("User", userSchema);
