import fs from "node:fs";
import mongoose from "mongoose";

async function main() {
  for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
  await mongoose.connect(process.env.MONGODB_URI as string);

  const shopModel =
    mongoose.models.Tenant ||
    mongoose.model("Tenant", new mongoose.Schema({}, { strict: false }), "tenants");
  const userModel =
    mongoose.models.User ||
    mongoose.model("User", new mongoose.Schema({}, { strict: false }), "users");

  const testShops = (await shopModel.find({ slug: { $in: [/^uishop-/, /^verify-/] } }).lean()) as Array<{
    _id: unknown;
    adminEmail: string;
  }>;

  for (const shop of testShops) {
    await userModel.deleteOne({ email: shop.adminEmail });
    await shopModel.deleteOne({ _id: shop._id });
  }
  console.log(`removed ${testShops.length} test shop(s)`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
