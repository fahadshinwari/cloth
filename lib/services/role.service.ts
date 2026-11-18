import "server-only";

import mongoose from "mongoose";
import {
  DEFAULT_SHOP_ROLES,
  PERMISSIONS,
  SYSTEM_ROLE_KEYS,
  type Permission,
} from "../constants";
import { RoleModel, UserModel, type RoleDocument } from "../models";
import { connectToDatabase } from "../mongodb";
import { slugify, type RolePermissionInput } from "../validation";

export class RoleServiceError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "RoleServiceError";
    this.field = field;
  }
}

function assertTenantId(tenantId: string): void {
  if (!/^[a-f\d]{24}$/i.test(tenantId)) {
    throw new RoleServiceError("Invalid tenant.");
  }
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

/** Keeps only known permissions and removes duplicates. */
export function sanitizePermissions(values: unknown): Permission[] {
  const list = Array.isArray(values) ? values : [];
  return Array.from(
    new Set(
      list
        .map((value) => String(value))
        .filter((value) => (PERMISSIONS as readonly string[]).includes(value)),
    ),
  ) as Permission[];
}

/**
 * Seeds the built-in roles for a shop if they do not exist yet.
 * Existing roles are never overwritten, so customisations survive.
 */
export async function ensureDefaultRoles(tenantId: string): Promise<void> {
  assertTenantId(tenantId);
  await connectToDatabase();
  const tenant = toObjectId(tenantId);

  await RoleModel.bulkWrite(
    DEFAULT_SHOP_ROLES.map((role) => ({
      updateOne: {
        filter: { tenantId: tenant, key: role.key },
        update: {
          $setOnInsert: {
            tenantId: tenant,
            key: role.key,
            name: role.name,
            permissions: role.permissions,
            isSystem: (SYSTEM_ROLE_KEYS as readonly string[]).includes(role.key),
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

export async function listRoles(tenantId: string): Promise<RoleDocument[]> {
  await ensureDefaultRoles(tenantId);
  return RoleModel.find({ tenantId: toObjectId(tenantId) }).sort({ isSystem: -1, name: 1 });
}

export async function getRoleById(
  tenantId: string,
  roleId: string,
): Promise<RoleDocument | null> {
  assertTenantId(tenantId);
  if (!/^[a-f\d]{24}$/i.test(roleId)) return null;
  await connectToDatabase();
  return RoleModel.findOne({ _id: toObjectId(roleId), tenantId: toObjectId(tenantId) });
}

export async function getRoleByKey(
  tenantId: string,
  key: string,
): Promise<RoleDocument | null> {
  assertTenantId(tenantId);
  await connectToDatabase();
  return RoleModel.findOne({
    tenantId: toObjectId(tenantId),
    key: key.trim().toLowerCase(),
  });
}

export async function createRole(
  tenantId: string,
  userId: string,
  input: RolePermissionInput,
): Promise<RoleDocument> {
  await ensureDefaultRoles(tenantId);
  const tenant = toObjectId(tenantId);

  const base = (slugify(input.name).slice(0, 32) || "role").replace(/-+$/, "");
  let key = base;
  let suffix = 2;
  while (await RoleModel.exists({ tenantId: tenant, key })) {
    key = `${base}-${suffix}`.slice(0, 40);
    suffix += 1;
  }

  return RoleModel.create({
    tenantId: tenant,
    key,
    name: input.name,
    permissions: sanitizePermissions(input.permissions),
    isSystem: false,
    createdBy: toObjectId(userId),
    updatedBy: toObjectId(userId),
  });
}

export async function updateRole(
  tenantId: string,
  roleId: string,
  userId: string,
  input: RolePermissionInput,
): Promise<RoleDocument> {
  const role = await getRoleById(tenantId, roleId);
  if (!role) throw new RoleServiceError("Role not found.");

  role.name = input.name;
  // The owner role always keeps every permission.
  role.permissions =
    role.key === "owner" ? [...PERMISSIONS] : sanitizePermissions(input.permissions);
  role.updatedBy = toObjectId(userId);
  await role.save();
  return role;
}

export async function deleteRole(tenantId: string, roleId: string): Promise<void> {
  const role = await getRoleById(tenantId, roleId);
  if (!role) return;

  if (role.isSystem || (SYSTEM_ROLE_KEYS as readonly string[]).includes(role.key)) {
    throw new RoleServiceError("System roles cannot be deleted.");
  }

  const assigned = await UserModel.countDocuments({
    tenantId: toObjectId(tenantId),
    roleKey: role.key,
  });
  if (assigned > 0) {
    throw new RoleServiceError(
      "This role is assigned to users. Move them to another role before deleting it.",
    );
  }

  await RoleModel.deleteOne({ _id: role._id });
}
