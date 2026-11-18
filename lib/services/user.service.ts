import "server-only";

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { USER_ROLE } from "../constants";
import { RoleModel, UserModel, type UserDocument } from "../models";
import { connectToDatabase } from "../mongodb";
import type { ShopUserInput } from "../validation";
import { ensureDefaultRoles } from "./role.service";

export class UserServiceError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "UserServiceError";
    this.field = field;
  }
}

function assertTenantId(tenantId: string): void {
  if (!/^[a-f\d]{24}$/i.test(tenantId)) {
    throw new UserServiceError("Invalid tenant.");
  }
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

function isOwner(user: UserDocument): boolean {
  return (user.roleKey || "owner") === "owner";
}

async function countOwners(tenantId: string): Promise<number> {
  return UserModel.countDocuments({
    tenantId: toObjectId(tenantId),
    role: USER_ROLE.MERCHANT_ADMIN,
    $or: [{ roleKey: "owner" }, { roleKey: { $exists: false } }],
  });
}

async function assertRoleExists(tenantId: string, roleKey: string): Promise<void> {
  const role = await RoleModel.findOne({
    tenantId: toObjectId(tenantId),
    key: roleKey,
  });
  if (!role) {
    throw new UserServiceError("Choose a valid role.", "roleKey");
  }
}

export async function listShopUsers(tenantId: string): Promise<UserDocument[]> {
  await ensureDefaultRoles(tenantId);
  return UserModel.find({ tenantId: toObjectId(tenantId) }).sort({ name: 1 });
}

export async function getShopUserById(
  tenantId: string,
  userId: string,
): Promise<UserDocument | null> {
  assertTenantId(tenantId);
  if (!/^[a-f\d]{24}$/i.test(userId)) return null;
  await connectToDatabase();
  return UserModel.findOne({ _id: toObjectId(userId), tenantId: toObjectId(tenantId) });
}

export async function createShopUser(
  tenantId: string,
  actorId: string,
  input: ShopUserInput,
): Promise<UserDocument> {
  await ensureDefaultRoles(tenantId);
  await assertRoleExists(tenantId, input.roleKey);

  const email = input.email.toLowerCase();
  const existing = await UserModel.findOne({ email });
  if (existing) {
    throw new UserServiceError("A user with this email already exists.", "email");
  }

  if (!input.password) {
    throw new UserServiceError("Password is required.", "password");
  }

  return UserModel.create({
    name: input.name,
    email,
    passwordHash: await bcrypt.hash(input.password, 12),
    role: USER_ROLE.MERCHANT_ADMIN,
    roleKey: input.roleKey,
    tenantId: toObjectId(tenantId),
    isActive: input.isActive,
    createdBy: toObjectId(actorId),
  });
}

export async function updateShopUser(
  tenantId: string,
  userId: string,
  actorId: string,
  input: ShopUserInput,
): Promise<UserDocument> {
  await ensureDefaultRoles(tenantId);
  await assertRoleExists(tenantId, input.roleKey);

  const user = await getShopUserById(tenantId, userId);
  if (!user) throw new UserServiceError("User not found.");

  if (String(user._id) === String(actorId) && !input.isActive) {
    throw new UserServiceError("You cannot deactivate your own account.", "isActive");
  }

  if (isOwner(user) && input.roleKey !== "owner") {
    const owners = await countOwners(tenantId);
    if (owners <= 1) {
      throw new UserServiceError(
        "This is the last owner account. Assign another owner before changing its role.",
        "roleKey",
      );
    }
  }

  const email = input.email.toLowerCase();
  const conflict = await UserModel.findOne({ email, _id: { $ne: user._id } });
  if (conflict) {
    throw new UserServiceError("A user with this email already exists.", "email");
  }

  user.name = input.name;
  user.email = email;
  user.roleKey = input.roleKey;
  user.isActive = input.isActive;
  if (input.password) {
    user.passwordHash = await bcrypt.hash(input.password, 12);
  }
  await user.save();
  return user;
}

export async function deleteShopUser(
  tenantId: string,
  userId: string,
  actorId: string,
): Promise<void> {
  if (String(userId) === String(actorId)) {
    throw new UserServiceError("You cannot delete your own account.");
  }

  const user = await getShopUserById(tenantId, userId);
  if (!user) return;

  if (isOwner(user)) {
    const owners = await countOwners(tenantId);
    if (owners <= 1) {
      throw new UserServiceError("The last owner account cannot be deleted.");
    }
  }

  await UserModel.deleteOne({ _id: user._id });
}

export async function setShopUserActive(
  tenantId: string,
  userId: string,
  actorId: string,
  active: boolean,
): Promise<void> {
  if (String(userId) === String(actorId) && !active) {
    throw new UserServiceError("You cannot deactivate your own account.");
  }

  const user = await getShopUserById(tenantId, userId);
  if (!user) return;

  if (isOwner(user) && !active) {
    const owners = await countOwners(tenantId);
    if (owners <= 1) {
      throw new UserServiceError("The last owner account cannot be deactivated.");
    }
  }

  user.isActive = active;
  await user.save();
}
