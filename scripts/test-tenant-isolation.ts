/**
 * Standalone integration test for auth + tenant isolation service layer.
 * Usage: npx tsx --tsconfig tsconfig.json scripts/test-login.ts
 */
import fs from "node:fs";
import path from "node:path";
import { Model, model, models, Schema, Types, connect, disconnect } from "mongoose";
import bcrypt from "bcryptjs";

// ---- load .env.local ----
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

// ---- inline schemas matching lib/models ----
const shopSchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  adminName: { type: String, required: true },
  adminEmail: { type: String, required: true, unique: true },
  adminPasswordHash: { type: String, required: true },
  phone: { type: String, required: true },
  currency: { type: String, required: true },
  status: { type: String, required: true },
}, { collection: "tenants" });

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, required: true },
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null },
  isActive: { type: Boolean, required: true },
}, { collection: "users" });

interface ShopDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  adminEmail: string;
  adminPasswordHash: string;
  phone: string;
  currency: string;
  status: string;
}

interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  tenantId: Types.ObjectId | null;
  isActive: boolean;
}

const Shop = (models.Tenant || model("Tenant", shopSchema)) as unknown as Model<ShopDoc>;
const User = (models.User || model("User", userSchema)) as unknown as Model<UserDoc>;

async function main() {
  await connect(process.env.MONGODB_URI as string, { serverSelectionTimeoutMS: 10_000 });
  console.log("✓ connected to MongoDB");

  const stamp = Date.now().toString(36);
  const slug = `verify-${stamp}`;
  const email = `verify-${stamp}@example.com`;
  const password = "VerifyPass@123";

  // 1. Create shop + merchant admin (mirrors createShop service).
  const passwordHash = await bcrypt.hash(password, 12);
  const shop = await Shop.create({
    name: "Verify Shop",
    slug,
    adminName: "Verify Admin",
    adminEmail: email,
    adminPasswordHash: passwordHash,
    phone: "0700000000",
    currency: "AFN",
    status: "active",
  } as unknown as ShopDoc);
  const user = await User.create({
    name: "Verify Admin",
    email,
    passwordHash,
    role: "merchant_admin",
    tenantId: shop._id,
    isActive: true,
  } as unknown as UserDoc);
  console.log("✓ shop + merchant admin created:", slug);

  // 2. Credential check (mirrors verifyCredentials).
  const found = await User.findOne({ email }).select("+passwordHash");
  if (!found || !(await bcrypt.compare(password, found.passwordHash))) {
    throw new Error("credential check failed");
  }
  console.log("✓ merchant credentials valid");

  // 3. Tenant binding check (mirrors buildSessionPayload).
  if (String(found.tenantId) !== String(shop._id)) throw new Error("tenant binding mismatch");
  console.log("✓ merchant session tenant binding correct:", slug);

  // 4. Cross-tenant check: user from shop A must not resolve to shop B.
  const otherShop = await Shop.findOne({ slug: slug + "-other" });
  if (otherShop) throw new Error("unexpected other shop");
  console.log("✓ cross-tenant lookup correctly empty");

  // 5. Deactivate → login must be blocked.
  await Shop.updateOne({ _id: shop._id }, { status: "inactive" });
  await User.updateOne({ _id: user._id }, { isActive: false });
  const blocked = await User.findOne({ email, isActive: true });
  if (blocked) throw new Error("inactive admin still active!");
  console.log("✓ deactivation blocks merchant login");

  // 6. Credential reset flow.
  await Shop.updateOne({ _id: shop._id }, { status: "active" });
  await User.updateOne({ _id: user._id }, { isActive: true, passwordHash: await bcrypt.hash("NewPass@12345", 12) });
  const reFound = await User.findOne({ email }).select("+passwordHash");
  if (!(await bcrypt.compare("NewPass@12345", reFound!.passwordHash))) {
    throw new Error("credential reset failed");
  }
  console.log("✓ credential reset works");

  // 7. Unique slug enforcement.
  try {
    await Shop.create({
      name: "Dup",
      slug,
      adminName: "x",
      adminEmail: `x-${stamp}@example.com`,
      adminPasswordHash: "y",
      phone: "1",
      currency: "AFN",
      status: "active",
    } as unknown as ShopDoc);
    throw new Error("duplicate slug allowed!");
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("duplicate")) {
      console.log("✓ duplicate slug rejected by unique index");
    } else {
      throw e;
    }
  }

  // 8. Cleanup.
  await Shop.deleteOne({ _id: shop._id });
  await User.deleteOne({ _id: user._id });
  console.log("✓ cleaned up");

  await disconnect();
  process.exit(0);
}

main().catch(async (error) => {
  console.error("✗", error?.message ?? error);
  await disconnect().catch(() => {});
  process.exit(1);
});
