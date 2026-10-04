/**
 * Seeds a realistic demo shop exercising every module:
 * partners + investments, supplier purchases (partial payments), buyer sales
 * (partial payments), inventory movements, teller cash.
 *
 * Usage: npx tsx scripts/seed-demo.ts   (idempotent — wipes and re-creates the demo tenant)
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

const DEMO_SLUG = "demo-cloth";
const EMAIL = "owner@demo-cloth.af";
const PASSWORD = "Demo@12345";

const shopSchema = new mongoose.Schema(
  {
    name: String,
    slug: { type: String, unique: true },
    adminName: String,
    adminEmail: String,
    adminPasswordHash: String,
    phone: String,
    currency: String,
    status: String,
    allowNegativeInventory: { type: Boolean, default: false },
  },
  { collection: "tenants" },
);
const userSchema = new mongoose.Schema(
  { name: String, email: String, passwordHash: String, role: String, tenantId: mongoose.Schema.Types.ObjectId, isActive: Boolean },
  { collection: "users" },
);
const partnerSchema = new mongoose.Schema({
  // Extended dynamically below since seed writes loosely-typed documents.
}, { collection: "partners", strict: false });
partnerSchema.add({
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true },
  name: String,
  phone: String,
  notes: String,
  status: String,
  createdBy: mongoose.Schema.Types.ObjectId,
  updatedBy: mongoose.Schema.Types.ObjectId,
});

async function main() {
  await mongoose.connect(MONGODB_URI as string);

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const Shop = (mongoose.models.Tenant as mongoose.Model<any>) || mongoose.model("Tenant", shopSchema);
  const User = (mongoose.models.User as mongoose.Model<any>) || mongoose.model("User", userSchema);
  const Partner = (mongoose.models.Partner as mongoose.Model<any>) || mongoose.model("Partner", partnerSchema);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const Investment = mongoose.models.Investment || mongoose.model("Investment", new mongoose.Schema({}, { collection: "investments", strict: false }));
  const Buyer = mongoose.models.Buyer || mongoose.model("Buyer", new mongoose.Schema({}, { collection: "buyers", strict: false }));
  const LedgerEntry = mongoose.models.LedgerEntry || mongoose.model("LedgerEntry", new mongoose.Schema({}, { collection: "ledger_entries", strict: false }));
  const Supplier = mongoose.models.Supplier || mongoose.model("Supplier", new mongoose.Schema({}, { collection: "suppliers", strict: false }));
  const SupplierLedgerEntry = mongoose.models.SupplierLedgerEntry || mongoose.model("SupplierLedgerEntry", new mongoose.Schema({}, { collection: "supplier_ledger_entries", strict: false }));
  const Cloth = mongoose.models.Cloth || mongoose.model("Cloth", new mongoose.Schema({}, { collection: "cloths", strict: false }));
  const InventoryMovement = mongoose.models.InventoryMovement || mongoose.model("InventoryMovement", new mongoose.Schema({}, { collection: "inventory_movements", strict: false }));
  const Teller = mongoose.models.TellerTransaction || mongoose.model("TellerTransaction", new mongoose.Schema({}, { collection: "teller_transactions", strict: false }));
  const Reminder = mongoose.models.PaymentReminder || mongoose.model("PaymentReminder", new mongoose.Schema({}, { collection: "payment_reminders", strict: false }));

  // Idempotent: remove previous demo tenant data.
  const existing = await Shop.findOne({ slug: DEMO_SLUG });
  if (existing) {
    const tenantId = existing._id;
    await Promise.all([
      Investment.deleteMany({ tenantId }),
      Partner.deleteMany({ tenantId }),
      Buyer.deleteMany({ tenantId }),
      LedgerEntry.deleteMany({ tenantId }),
      Supplier.deleteMany({ tenantId }),
      SupplierLedgerEntry.deleteMany({ tenantId }),
      Cloth.deleteMany({ tenantId }),
      InventoryMovement.deleteMany({ tenantId }),
      Teller.deleteMany({ tenantId }),
      Reminder.deleteMany({ tenantId }),
      User.deleteMany({ tenantId }),
      Shop.deleteOne({ _id: tenantId }),
    ]);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const shop = await Shop.create({
    name: "Demo Cloth House",
    slug: DEMO_SLUG,
    adminName: "Demo Owner",
    adminEmail: EMAIL,
    adminPasswordHash: passwordHash,
    phone: "+93 700 000 000",
    currency: "AFN",
    status: "active",
    allowNegativeInventory: false,
  });
  const tenantId = shop._id;

  const user = await User.create({
    name: "Demo Owner",
    email: EMAIL,
    passwordHash,
    role: "merchant_admin",
    tenantId,
    isActive: true,
  });
  const userId = user._id;

  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

  // --- Partner + investments (Scenario A) ---
  const partner = await Partner.create({
    tenantId, name: "Haji Farid", phone: "+93 799 111 222", notes: "Founding partner", status: "active",
    createdBy: userId, updatedBy: userId,
  });
  await Investment.create({ tenantId, partnerId: partner._id, amountMinor: 20_000_00, currency: "USD", investedAt: daysAgo(20), note: "Initial investment", createdBy: userId });
  await Investment.create({ tenantId, partnerId: partner._id, amountMinor: 5_000_000, currency: "AFN", investedAt: daysAgo(10), note: "Second investment", createdBy: userId });
  console.log("A. Partner created: Haji Farid — USD 20,000 + AFN 5,000 invested");

  // --- Supplier + purchases (Scenario B/C) ---
  const supplier = await Supplier.create({
    tenantId, name: "ABC Importer", companyName: "ABC Trading Co", phone: "+93 788 333 444",
    address: "Kabul", notes: "Main fabric importer", status: "active", createdBy: userId, updatedBy: userId,
  });

  const cloth = await Cloth.create({
    tenantId, name: "Linen", category: "Linen", description: "Premium linen",
    pricePerMeterMinor: 10_000, currency: "AFN", supplierId: supplier._id, lowStockThresholdMm: 500_000,
    notes: "", createdBy: userId, updatedBy: userId,
  });
  const clothCotton = await Cloth.create({
    tenantId, name: "Cotton", category: "Cotton", description: "Soft cotton",
    pricePerMeterMinor: 500, currency: "USD", supplierId: supplier._id, lowStockThresholdMm: 300_000,
    notes: "", createdBy: userId, updatedBy: userId,
  });

  // Purchase 1: 2,000 m linen @100 AFN = 200,000 AFN, credit, paid 50,000 immediately
  const mv1 = await InventoryMovement.create({
    tenantId, clothId: cloth._id, direction: "in", quantityMm: 2_000_000,
    pricePerMeterMinor: 10_000, totalValueMinor: 200_000_000, currency: "AFN",
    sourceType: "purchase", supplierId: supplier._id, occurredAt: daysAgo(18), note: "Container 1", createdBy: userId,
  });
  await SupplierLedgerEntry.create({ tenantId, supplierId: supplier._id, type: "purchase", amountMinor: 200_000_000, currency: "AFN", occurredAt: daysAgo(18), note: "Container 1 — 2,000 m linen", inventoryMovementId: mv1._id, createdBy: userId });
  await SupplierLedgerEntry.create({ tenantId, supplierId: supplier._id, type: "payment", amountMinor: 50_000_000, currency: "AFN", occurredAt: daysAgo(18), note: "Down payment container 1", inventoryMovementId: mv1._id, createdBy: userId });

  // Purchase 2: 1,000 m more linen, fully on credit
  const mv2 = await InventoryMovement.create({
    tenantId, clothId: cloth._id, direction: "in", quantityMm: 1_000_000,
    pricePerMeterMinor: 10_000, totalValueMinor: 100_000_000, currency: "AFN",
    sourceType: "purchase", supplierId: supplier._id, occurredAt: daysAgo(8), note: "Container 2", createdBy: userId,
  });
  await SupplierLedgerEntry.create({ tenantId, supplierId: supplier._id, type: "purchase", amountMinor: 100_000_000, currency: "AFN", occurredAt: daysAgo(8), note: "Container 2 — 1,000 m linen", inventoryMovementId: mv2._id, createdBy: userId });

  // Purchase 3: 2,000 m cotton @ $5 = $10,000 fully paid
  const mv3 = await InventoryMovement.create({
    tenantId, clothId: clothCotton._id, direction: "in", quantityMm: 2_000_000,
    pricePerMeterMinor: 500, totalValueMinor: 10_000_00, currency: "USD",
    sourceType: "purchase", supplierId: supplier._id, occurredAt: daysAgo(15), note: "Cotton shipment", createdBy: userId,
  });
  await SupplierLedgerEntry.create({ tenantId, supplierId: supplier._id, type: "purchase", amountMinor: 10_000_00, currency: "USD", occurredAt: daysAgo(15), note: "Cotton shipment — 2,000 m", inventoryMovementId: mv3._id, createdBy: userId });
  await SupplierLedgerEntry.create({ tenantId, supplierId: supplier._id, type: "payment", amountMinor: 10_000_00, currency: "USD", occurredAt: daysAgo(15), note: "Paid cotton in full", inventoryMovementId: mv3._id, createdBy: userId });

  // Scenario C: partial supplier payment later (40,000 AFN)
  await SupplierLedgerEntry.create({ tenantId, supplierId: supplier._id, type: "payment", amountMinor: 40_000_000, currency: "AFN", occurredAt: daysAgo(5), note: "Partial payment", createdBy: userId });

  // Supplier balance check: AFN (200,000 + 100,000) - (50,000 + 40,000) = 210,000 AFN
  console.log("B/C. Supplier ABC Importer: 3,000 m linen + 2,000 m cotton received; AFN payable = 210,000; USD payable = 0");

  // --- Buyer + sales (Scenario D/E) ---
  const buyer = await Buyer.create({
    tenantId, name: "Ahmad", shopName: "Ahmad Clothing Shop", phone: "+93 777 555 666",
    address: "Mazar", notes: "Weekly Thursday payments", status: "active", createdBy: userId, updatedBy: userId,
  });

  // Sale 1: 1,000 m cotton @ $5 = $5,000 on credit, paid $1,000 now
  const sm1 = await InventoryMovement.create({
    tenantId, clothId: clothCotton._id, direction: "out", quantityMm: 1_000_000,
    pricePerMeterMinor: 500, totalValueMinor: 5_000_00, currency: "USD",
    sourceType: "sale", buyerId: buyer._id, occurredAt: daysAgo(12), note: "Wholesale bundle 1", createdBy: userId,
  });
  await LedgerEntry.create({ tenantId, buyerId: buyer._id, type: "goods", amountMinor: 5_000_00, currency: "USD", occurredAt: daysAgo(12), note: "Wholesale bundle 1 — 1,000 m cotton", inventoryMovementId: sm1._id, createdBy: userId });
  await LedgerEntry.create({ tenantId, buyerId: buyer._id, type: "payment", amountMinor: 1_000_00, currency: "USD", occurredAt: daysAgo(12), note: "Down payment", inventoryMovementId: sm1._id, createdBy: userId });

  // Sale 2: 500 m linen @ 120 AFN = 60,000 AFN on credit
  const sm2 = await InventoryMovement.create({
    tenantId, clothId: cloth._id, direction: "out", quantityMm: 500_000,
    pricePerMeterMinor: 12_000, totalValueMinor: 60_000_000, currency: "AFN",
    sourceType: "sale", buyerId: buyer._id, occurredAt: daysAgo(7), note: "Linen order", createdBy: userId,
  });
  await LedgerEntry.create({ tenantId, buyerId: buyer._id, type: "goods", amountMinor: 60_000_000, currency: "AFN", occurredAt: daysAgo(7), note: "Linen order — 500 m", inventoryMovementId: sm2._id, createdBy: userId });

  // Scenario E: two partial buyer payments (15,000 AFN then 10,000 AFN)
  await LedgerEntry.create({ tenantId, buyerId: buyer._id, type: "payment", amountMinor: 15_000_000, currency: "AFN", occurredAt: daysAgo(4), note: "Weekly payment", createdBy: userId });
  await LedgerEntry.create({ tenantId, buyerId: buyer._id, type: "payment", amountMinor: 10_000_000, currency: "AFN", occurredAt: daysAgo(1), note: "Weekly payment", createdBy: userId });

  console.log("D/E. Buyer Ahmad: goods USD 5,000 + AFN 60,000; paid USD 1,000 + AFN 25,000; outstanding USD 4,000 / AFN 35,000");

  // --- Reminder (informational) ---
  await Reminder.create({
    tenantId, buyerId: buyer._id, schedule: "weekly", weekday: 4, amountMinor: 15_000_000,
    currency: "AFN", note: "Promised every Thursday", active: true,
  });

  // --- Teller (Scenario F) ---
  await Teller.create({ tenantId, type: "add", amountMinor: 300_000_000, currency: "AFN", occurredAt: daysAgo(20), note: "Opening cash", createdBy: userId });
  await Teller.create({ tenantId, type: "add", amountMinor: 15_000_000, currency: "AFN", occurredAt: daysAgo(4), note: "Buyer weekly payment", createdBy: userId });
  await Teller.create({ tenantId, type: "add", amountMinor: 10_000_000, currency: "AFN", occurredAt: daysAgo(1), note: "Buyer weekly payment", createdBy: userId });
  await Teller.create({ tenantId, type: "add", amountMinor: 1_000_00, currency: "USD", occurredAt: daysAgo(12), note: "Buyer down payment", createdBy: userId });
  await Teller.create({ tenantId, type: "remove", amountMinor: 20_000_000, currency: "AFN", occurredAt: daysAgo(3), note: "Shop expenses", createdBy: userId });
  console.log("F. Teller: AFN (300,000 + 25,000 - 20,000) = 305,000 | USD 1,000");

  // Final inventory: linen 3,000 - 500 = 2,500 m; cotton 2,000 - 1,000 = 1,000 m
  console.log("Inventory: Linen 2,500 m | Cotton 1,000 m");

  console.log(`\nDemo shop ready: /${DEMO_SLUG}/login — ${EMAIL} / ${PASSWORD}`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
