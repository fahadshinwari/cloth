/**
 * Seeds (or updates) the Super Admin account.
 * Usage: npm run db:seed
 *
 * Loads .env.local manually because Next.js env files are not
 * auto-loaded outside of `next` commands.
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2];
    }
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
}

const NAME = process.env.SUPER_ADMIN_NAME ?? "Super Admin";
const EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? "admin@baseer.com").toLowerCase();
const PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? "SuperAdmin@123";

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  passwordHash: String,
  role: String,
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Tenant", default: null },
  isActive: { type: Boolean, default: true },
}, { collection: "users" });

const User = mongoose.models.User || mongoose.model("User", userSchema);

async function main() {
  await mongoose.connect(MONGODB_URI as string);
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const existing = await User.findOne({ email: EMAIL });
  if (existing) {
    await User.updateOne(
      { email: EMAIL },
      { $set: { passwordHash, role: "super_admin", isActive: true, name: NAME } },
    );
    console.log(`Super admin updated: ${EMAIL}`);
  } else {
    await User.create({
      name: NAME,
      email: EMAIL,
      passwordHash,
      role: "super_admin",
      tenantId: null,
      isActive: true,
    });
    console.log(`Super admin created: ${EMAIL}`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
