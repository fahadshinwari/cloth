import "server-only";
import bcrypt from "bcryptjs";
import { ShopModel, UserModel, type ShopDocument } from "../models";
import { connectToDatabase } from "../mongodb";
import { USER_ROLE, SHOP_STATUS } from "../constants";
import type { ShopInput, ResetCredentialsInput } from "../validation";
import { slugify } from "../validation";

export class TenantServiceError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "TenantServiceError";
    this.field = field;
  }
}

export async function listShops(): Promise<ShopDocument[]> {
  await connectToDatabase();
  return ShopModel.find().sort({ createdAt: -1 });
}

export async function listActiveShops() {
  await connectToDatabase();
  return ShopModel.find({ status: SHOP_STATUS.ACTIVE }).select("name slug currency").lean();
}

export async function getShopBySlug(slug: string): Promise<ShopDocument | null> {
  await connectToDatabase();
  return ShopModel.findOne({ slug: slug.toLowerCase() });
}

export async function getShopById(id: string): Promise<ShopDocument | null> {
  await connectToDatabase();
  return ShopModel.findById(id);
}

/**
 * Creates a shop and its merchant admin user in one transaction-like flow.
 */
export async function createShop(input: ShopInput): Promise<ShopDocument> {
  await connectToDatabase();

  const slug = slugify(input.slug);
  const email = input.adminEmail.toLowerCase();

  const existingSlug = await ShopModel.findOne({ slug });
  if (existingSlug) {
    throw new TenantServiceError("A shop with this slug already exists.", "slug");
  }

  const existingEmail = await UserModel.findOne({ email });
  if (existingEmail) {
    throw new TenantServiceError("A user with this email already exists.", "adminEmail");
  }

  const passwordHash = await bcrypt.hash(input.adminPassword ?? "", 12);

  const shop = await ShopModel.create({
    name: input.name,
    slug,
    adminName: input.adminName,
    adminEmail: email,
    adminPasswordHash: passwordHash,
    phone: input.phone,
    currency: input.currency,
    status: input.status,
  });

  await UserModel.create({
    name: input.adminName,
    email,
    passwordHash,
    role: USER_ROLE.MERCHANT_ADMIN,
    tenantId: shop._id,
    isActive: true,
  });

  return shop;
}

export async function updateShop(id: string, input: ShopInput): Promise<ShopDocument> {
  await connectToDatabase();

  const shop = await ShopModel.findById(id);
  if (!shop) throw new TenantServiceError("Shop not found.");

  const slug = slugify(input.slug);
  const email = input.adminEmail.toLowerCase();

  const slugConflict = await ShopModel.findOne({ slug, _id: { $ne: shop._id } });
  if (slugConflict) {
    throw new TenantServiceError("A shop with this slug already exists.", "slug");
  }

  const emailConflict = await UserModel.findOne({
    email,
    role: USER_ROLE.MERCHANT_ADMIN,
    tenantId: { $ne: shop._id },
  });
  if (emailConflict) {
    throw new TenantServiceError("A user with this email already exists.", "adminEmail");
  }

  shop.name = input.name;
  shop.slug = slug;
  shop.adminName = input.adminName;
  shop.adminEmail = email;
  shop.phone = input.phone;
  shop.currency = input.currency;
  shop.status = input.status;
  await shop.save();

  // Keep the merchant admin user record in sync with shop identity fields.
  await UserModel.updateOne(
    { role: USER_ROLE.MERCHANT_ADMIN, tenantId: shop._id },
    {
      $set: {
        name: input.adminName,
        email,
        ...(input.adminPassword ? { password: undefined } : {}),
      },
    },
  );

  if (input.adminPassword) {
    const passwordHash = await bcrypt.hash(input.adminPassword, 12);
    await UserModel.updateOne(
      { role: USER_ROLE.MERCHANT_ADMIN, tenantId: shop._id },
      { $set: { passwordHash } },
    );
    shop.adminPasswordHash = passwordHash;
    await shop.save();
  }

  return shop;
}

export async function setShopStatus(id: string, status: "active" | "inactive"): Promise<ShopDocument> {
  await connectToDatabase();

  const shop = await ShopModel.findByIdAndUpdate(id, { status }, { new: true });
  if (!shop) throw new TenantServiceError("Shop not found.");

  // Deactivating a shop immediately blocks its admin from signing in.
  await UserModel.updateOne(
    { role: USER_ROLE.MERCHANT_ADMIN, tenantId: shop._id },
    { $set: { isActive: status === SHOP_STATUS.ACTIVE } },
  );

  return shop;
}

/**
 * Resets merchant admin credentials (email and/or password).
 */
export async function resetShopCredentials(
  shopId: string,
  input: ResetCredentialsInput,
): Promise<void> {
  await connectToDatabase();

  const shop = await ShopModel.findById(shopId);
  if (!shop) throw new TenantServiceError("Shop not found.");

  const update: Record<string, unknown> = {};
  const shopUpdate: Record<string, unknown> = {};

  if (input.adminEmail) {
    const conflict = await UserModel.findOne({
      email: input.adminEmail,
      tenantId: { $ne: shop._id },
    });
    if (conflict) {
      throw new TenantServiceError("A user with this email already exists.", "adminEmail");
    }
    update.email = input.adminEmail;
    shopUpdate.adminEmail = input.adminEmail;
  }

  if (input.adminPassword) {
    update.passwordHash = await bcrypt.hash(input.adminPassword, 12);
    shopUpdate.adminPasswordHash = update.passwordHash;
  }

  if (Object.keys(update).length > 0) {
    await UserModel.updateOne(
      { role: USER_ROLE.MERCHANT_ADMIN, tenantId: shop._id },
      { $set: update },
    );
  }

  if (Object.keys(shopUpdate).length > 0) {
    await ShopModel.updateOne({ _id: shop._id }, { $set: shopUpdate });
  }
}

export async function countMerchants(): Promise<number> {
  await connectToDatabase();
  return UserModel.countDocuments({ role: USER_ROLE.MERCHANT_ADMIN });
}
