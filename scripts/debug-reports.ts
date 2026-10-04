import fs from "node:fs";
import path from "node:path";
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2];
  }
}
const day = (n: number) => new Date(Date.now() - n * 86_400_000);
async function main() {
  const { connectToDatabase } = await import("../lib/mongodb");
  const { ShopModel, BuyerModel, LedgerEntryModel, ClothModel, SupplierModel } = await import("../lib/models");
  const { createBuyer, getBuyerLedgerTotals } = await import("../lib/services/buyer.service");
  const { createSupplier } = await import("../lib/services/supplier.service");
  const { createCloth, recordInventoryTransaction } = await import("../lib/services/inventory.service");
  const { getBuyerReport, getSupplierReport } = await import("../lib/reports");
  const bcrypt = (await import("bcryptjs")).default;
  await connectToDatabase();
  const passwordHash = await bcrypt.hash("Debug@12345", 4);
  const shop = await ShopModel.create({
    name: "Debug", slug: `debug-${Date.now()}`, adminName: "D", adminEmail: `d-${Date.now()}@t.test`,
    adminPasswordHash: passwordHash, phone: "+93 700 000 009", currency: "AFN", status: "active",
  });
  const tenantId = String(shop._id);
  const user = String((await (await import("../lib/models")).UserModel.create({
    name: "D", email: `d-${Date.now()}@t.test`, passwordHash, role: "merchant_admin", tenantId: shop._id, isActive: true,
  }))._id);

  const cotton = await createCloth(tenantId, user, { name: "Cotton", category: "", description: "", pricePerMeter: "100", currency: "AFN", supplierId: null, lowStockThresholdMeters: "", notes: "" });
  const sup = await createSupplier(tenantId, user, { name: "Supplier A", companyName: "", phone: "", address: "", notes: "", status: "active" });
  const buyer = await createBuyer(tenantId, user, { name: "Ahmad", shopName: "", phone: "", address: "", notes: "", status: "active" });

  await recordInventoryTransaction(tenantId, user, {
    clothId: String(cotton._id), direction: "in", sourceType: "purchase",
    quantityMeters: "3000", pricePerMeter: "100", currency: "AFN",
    supplierId: String(sup._id), buyerId: null, occurredAt: day(1), note: "", credit: true, amountPaid: "0",
  });
  await recordInventoryTransaction(tenantId, user, {
    clothId: String(cotton._id), direction: "out", sourceType: "sale",
    quantityMeters: "1000", pricePerMeter: "100", currency: "AFN",
    supplierId: null, buyerId: String(buyer._id), occurredAt: day(0), note: "", credit: true, amountPaid: "0",
  });

  // Raw ledger entries:
  const raw = await LedgerEntryModel.find({ tenantId: (await import("mongoose")).default.Types.ObjectId.createFromHexString(tenantId) }).lean();
  console.log("raw entries:", raw.map(e => ({ type: e.type, amt: e.amountMinor, cur: e.currency, tenant: String(e.tenantId) === tenantId })));

  const totals = await getBuyerLedgerTotals(tenantId, String(buyer._id));
  console.log("buyer totals:", totals.outstanding);

  const report = await getBuyerReport(tenantId, { buyerId: String(buyer._id) });
  console.log("buyer report rows:", report.map(r => ({ name: r.name, cur: r.currency, g: r.goodsMinor, p: r.paymentsMinor })));

  const supReport = await getSupplierReport(tenantId, { supplierId: String(sup._id) });
  console.log("supplier report rows:", supReport.map(r => ({ name: r.name, cur: r.currency, r: r.purchasesMinor, p: r.paymentsMinor })));

  // cleanup
  await LedgerEntryModel.deleteMany({ tenantId: shop._id });
  await (await import("../lib/models")).SupplierLedgerEntryModel.deleteMany({ tenantId: shop._id });
  await (await import("../lib/models")).InventoryMovementModel.deleteMany({ tenantId: shop._id });
  await ClothModel.deleteMany({ tenantId: shop._id });
  await BuyerModel.deleteMany({ tenantId: shop._id });
  await SupplierModel.deleteMany({ tenantId: shop._id });
  await (await import("../lib/models")).UserModel.deleteMany({ tenantId: shop._id });
  await ShopModel.deleteOne({ _id: shop._id });
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
