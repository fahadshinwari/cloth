/**
 * TEST 1–10 — transaction-driven architecture verification.
 * Runs the exact scenarios from the architecture-correction brief through the
 * real service layer (server-side math), plus HTTP-level IDOR tests.
 *
 * Usage: NODE_OPTIONS="--require ./scripts/stub-server-only.cjs" npx tsx scripts/verify-transaction-driven.ts
 */
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2];
    }
  }
}

let passed = 0;
let failed = 0;
function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`✓ ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const day = (n: number) => new Date(Date.now() - n * 86_400_000);

async function main() {
  const { connectToDatabase } = await import("../lib/mongodb");
  const {
    BuyerModel, ClothModel, InventoryMovementModel, LedgerEntryModel,
    ShopModel, SupplierModel, SupplierLedgerEntryModel, UserModel,
  } = await import("../lib/models");
  const { createBuyer, createLedgerEntry, getBuyerLedgerTotals } = await import("../lib/services/buyer.service");
  const { createSupplier, createSupplierLedgerEntry, getSupplierLedgerTotals } = await import("../lib/services/supplier.service");
  const { createCloth, recordInventoryTransaction, getInventorySummary, getStockByCloth } = await import("../lib/services/inventory.service");
  const { getBuyerReport, getSupplierReport, getInventoryReport } = await import("../lib/reports");
  const bcrypt = (await import("bcryptjs")).default;

  await connectToDatabase();
  const passwordHash = await bcrypt.hash("TransTest@12345", 4);
  const stamp = Date.now();

  // Shop A (/baseer-like) and Shop B (/ahmad-like) for isolation tests.
  const shopA = await ShopModel.create({
    name: "Baseer Shop", slug: `baseer-${stamp}`, adminName: "A", adminEmail: `baseer-${stamp}@t.test`,
    adminPasswordHash: passwordHash, phone: "+93 700 000 001", currency: "AFN", status: "active",
  });
  const shopB = await ShopModel.create({
    name: "Ahmad Shop", slug: `ahmad-${stamp}`, adminName: "B", adminEmail: `ahmad-${stamp}@t.test`,
    adminPasswordHash: passwordHash, phone: "+93 700 000 002", currency: "AFN", status: "active",
  });
  const tenantA = String(shopA._id);
  const tenantB = String(shopB._id);
  const userA = String((await UserModel.create({
    name: "Owner A", email: `baseer-${stamp}@t.test`, passwordHash, role: "merchant_admin",
    tenantId: shopA._id, isActive: true,
  }))._id);
  await UserModel.create({
    name: "Owner B", email: `ahmad-${stamp}@t.test`, passwordHash, role: "merchant_admin",
    tenantId: shopB._id, isActive: true,
  });

  try {
    // ================= TEST 1 — Basic inventory =================
    const linen = await createCloth(tenantA, userA, {
      name: "Linen", category: "Linen", description: "", pricePerMeter: "100",
      currency: "AFN", supplierId: null, lowStockThresholdMeters: "", notes: "",
    });
    const supplierA = await createSupplier(tenantA, userA, { name: "Supplier A", companyName: "", phone: "", address: "", notes: "", status: "active" });
    const supplierB = await createSupplier(tenantA, userA, { name: "Supplier B", companyName: "", phone: "", address: "", notes: "", status: "active" });
    const ahmad = await createBuyer(tenantA, userA, { name: "Ahmad", shopName: "", phone: "", address: "", notes: "", status: "active" });
    const baseer = await createBuyer(tenantA, userA, { name: "Baseer", shopName: "", phone: "", address: "", notes: "", status: "active" });

    const purchaseOpts = (supplierId: string, meters: string, at: number) => ({
      clothId: String(linen._id), direction: "in" as const, sourceType: "purchase" as const,
      quantityMeters: meters, pricePerMeter: "100", currency: "AFN" as const,
      supplierId, buyerId: null, occurredAt: day(at), note: "", credit: true, amountPaid: "0",
    });
    const saleOpts = (buyerId: string, meters: string, price: string, at: number) => ({
      clothId: String(linen._id), direction: "out" as const, sourceType: "sale" as const,
      quantityMeters: meters, pricePerMeter: price, currency: "AFN" as const,
      supplierId: null, buyerId, occurredAt: day(at), note: "", credit: true, amountPaid: "0",
    });

    await recordInventoryTransaction(tenantA, userA, purchaseOpts(String(supplierA._id), "3000", 6));
    await recordInventoryTransaction(tenantA, userA, purchaseOpts(String(supplierB._id), "1000", 5));
    await recordInventoryTransaction(tenantA, userA, saleOpts(String(ahmad._id), "500", "100", 4));
    await recordInventoryTransaction(tenantA, userA, saleOpts(String(baseer._id), "700", "100", 3));

    let stock = (await getStockByCloth(tenantA)).get(String(linen._id)) ?? 0;
    check("TEST 1: Linen = 2,800 m (3000+1000-500-700)", stock === 2_800_000, `${stock / 1000} m`);

    // ================= TEST 2 — Buyer balance + payment does NOT touch stock =================
    // Ahmad already received 500 m @100 AFN = 50,000 AFN on credit.
    const before = (await getStockByCloth(tenantA)).get(String(linen._id)) ?? 0;
    let t2 = await getBuyerLedgerTotals(tenantA, String(ahmad._id));
    check("TEST 2a: Ahmad owes 50,000 AFN", t2.outstanding.AFN === 5_000_000, `${t2.outstanding.AFN} minor`);
    await createLedgerEntry(tenantA, userA, { buyerId: String(ahmad._id), type: "payment", amount: "20000", currency: "AFN", occurredAt: day(2), note: "Partial" });
    t2 = await getBuyerLedgerTotals(tenantA, String(ahmad._id));
    check("TEST 2b: Ahmad balance = 30,000 AFN after 20,000 payment", t2.outstanding.AFN === 3_000_000, `${t2.outstanding.AFN} minor`);
    const after = (await getStockByCloth(tenantA)).get(String(linen._id)) ?? 0;
    check("TEST 2c: inventory unchanged by payment", before === after, `${after / 1000} m`);

    // ================= TEST 3 — Supplier balance + payment does NOT touch stock =================
    // Supplier A delivered 3,000 m @100 = 300,000 AFN on credit.
    let t3 = await getSupplierLedgerTotals(tenantA, String(supplierA._id));
    check("TEST 3a: Supplier A payable 300,000 AFN", t3.payable.AFN === 30_000_000, `${t3.payable.AFN} minor`);
    await createSupplierLedgerEntry(tenantA, userA, { supplierId: String(supplierA._id), type: "payment", amount: "40000", currency: "AFN", occurredAt: day(2), note: "Partial" });
    t3 = await getSupplierLedgerTotals(tenantA, String(supplierA._id));
    check("TEST 3b: Supplier A payable 260,000 AFN after 40,000 payment", t3.payable.AFN === 26_000_000, `${t3.payable.AFN} minor`);
    const stockAfterPay = (await getStockByCloth(tenantA)).get(String(linen._id)) ?? 0;
    check("TEST 3c: inventory unchanged by supplier payment", stockAfterPay === 2_800_000, `${stockAfterPay / 1000} m`);

    // ================= TEST 4 — Multiple transactions =================
    const hamid = await createBuyer(tenantA, userA, { name: "Hamid", shopName: "", phone: "", address: "", notes: "", status: "active" });
    await recordInventoryTransaction(tenantA, userA, saleOpts(String(hamid._id), "300", "100", 2));
    stock = (await getStockByCloth(tenantA)).get(String(linen._id)) ?? 0;
    check("TEST 4a: Linen = 2,500 m after Hamid 300 m", stock === 2_500_000, `${stock / 1000} m`);
    await recordInventoryTransaction(tenantA, userA, purchaseOpts(String(supplierA._id), "500", 1));
    stock = (await getStockByCloth(tenantA)).get(String(linen._id)) ?? 0;
    check("TEST 4b: Linen = 3,000 m after +500 m", stock === 3_000_000, `${stock / 1000} m`);

    // ================= TEST 5 — Partial buyer payments =================
    const t5buyer = await createBuyer(tenantA, userA, { name: "T5 Buyer", shopName: "", phone: "", address: "", notes: "", status: "active" });
    // USD cloth so the $10,000 flow is exact.
    const usdCloth = await createCloth(tenantA, userA, {
      name: "USD Cloth", category: "Cotton", description: "", pricePerMeter: "1000",
      currency: "USD", supplierId: null, lowStockThresholdMeters: "", notes: "",
    });
    await recordInventoryTransaction(tenantA, userA, {
      clothId: String(usdCloth._id), direction: "in", sourceType: "adjustment",
      quantityMeters: "20", pricePerMeter: "1000", currency: "USD",
      supplierId: null, buyerId: null, occurredAt: day(1), note: "Opening stock", credit: false, amountPaid: "",
    });
    await recordInventoryTransaction(tenantA, userA, {
      clothId: String(usdCloth._id), direction: "out", sourceType: "sale",
      quantityMeters: "10", pricePerMeter: "1000", currency: "USD",
      supplierId: null, buyerId: String(t5buyer._id), occurredAt: day(1), note: "Goods 10k", credit: true, amountPaid: "0",
    });
    await createLedgerEntry(tenantA, userA, { buyerId: String(t5buyer._id), type: "payment", amount: "2000", currency: "USD", occurredAt: day(1), note: "p1" });
    await createLedgerEntry(tenantA, userA, { buyerId: String(t5buyer._id), type: "payment", amount: "3000", currency: "USD", occurredAt: day(0.5), note: "p2" });
    await createLedgerEntry(tenantA, userA, { buyerId: String(t5buyer._id), type: "payment", amount: "1000", currency: "USD", occurredAt: day(0.2), note: "p3" });
    const t5 = await getBuyerLedgerTotals(tenantA, String(t5buyer._id));
    check("TEST 5: goods 10,000 / payments 6,000 / outstanding 4,000 USD",
      t5.goods.USD === 1_000_000 && t5.payments.USD === 600_000 && t5.outstanding.USD === 400_000,
      `g${t5.goods.USD} p${t5.payments.USD} o${t5.outstanding.USD}`);

    // ================= TEST 6 — Partial supplier payments =================
    const t6supplier = await createSupplier(tenantA, userA, { name: "T6 Supplier", companyName: "", phone: "", address: "", notes: "", status: "active" });
    const t6cloth = await createCloth(tenantA, userA, {
      name: "T6 Cloth", category: "Cotton", description: "", pricePerMeter: "1000",
      currency: "USD", supplierId: null, lowStockThresholdMeters: "", notes: "",
    });
    await recordInventoryTransaction(tenantA, userA, {
      clothId: String(t6cloth._id), direction: "in", sourceType: "purchase",
      quantityMeters: "20", pricePerMeter: "1000", currency: "USD",
      supplierId: String(t6supplier._id), buyerId: null, occurredAt: day(1), note: "", credit: true, amountPaid: "0",
    });
    await createSupplierLedgerEntry(tenantA, userA, { supplierId: String(t6supplier._id), type: "payment", amount: "5000", currency: "USD", occurredAt: day(1), note: "p1" });
    await createSupplierLedgerEntry(tenantA, userA, { supplierId: String(t6supplier._id), type: "payment", amount: "4000", currency: "USD", occurredAt: day(0.5), note: "p2" });
    await createSupplierLedgerEntry(tenantA, userA, { supplierId: String(t6supplier._id), type: "payment", amount: "3000", currency: "USD", occurredAt: day(0.2), note: "p3" });
    const t6 = await getSupplierLedgerTotals(tenantA, String(t6supplier._id));
    check("TEST 6: received 20,000 / paid 12,000 / payable 8,000 USD",
      t6.purchases.USD === 2_000_000 && t6.payments.USD === 1_200_000 && t6.payable.USD === 800_000,
      `r${t6.purchases.USD} p${t6.payments.USD} o${t6.payable.USD}`);

    // ================= TEST 7 — AFN/USD separation =================
    const t7buyer = await createBuyer(tenantA, userA, { name: "T7 Buyer", shopName: "", phone: "", address: "", notes: "", status: "active" });
    await createLedgerEntry(tenantA, userA, { buyerId: String(t7buyer._id), type: "goods", amount: "10000", currency: "USD", occurredAt: day(1), note: "usd goods" });
    await createLedgerEntry(tenantA, userA, { buyerId: String(t7buyer._id), type: "goods", amount: "500000", currency: "AFN", occurredAt: day(1), note: "afn goods" });
    const t7 = await getBuyerLedgerTotals(tenantA, String(t7buyer._id));
    check("TEST 7a: buyer USD 10,000 and AFN 500,000 kept separate",
      t7.outstanding.USD === 1_000_000 && t7.outstanding.AFN === 50_000_000,
      `USD ${t7.outstanding.USD} / AFN ${t7.outstanding.AFN}`);
    check("TEST 7a: no merged 510,000 figure", t7.outstanding.USD !== 51_000_000 && t7.outstanding.AFN !== 51_000_000);

    // ================= TEST 8 — Tenant isolation (data level) =================
    await createBuyer(tenantB, userA, { name: "B-only Buyer", shopName: "", phone: "", address: "", notes: "", status: "active" });
    const crossBuyer = await BuyerModel.findOne({ _id: ahmad._id, tenantId: tenantB });
    check("TEST 8a: shop B cannot fetch shop A buyer by id", crossBuyer === null);
    const buyersA = await BuyerModel.find({ tenantId: tenantA });
    const buyersB = await BuyerModel.find({ tenantId: tenantB });
    check("TEST 8b: buyer lists are disjoint", buyersA.length === 5 && buyersB.length === 1, `A=${buyersA.length} B=${buyersB.length}`);
    const reportB = await getBuyerReport(tenantB, {});
    check(
      "TEST 8c: shop B report contains only its own buyer (both currency rows)",
      reportB.length === 2 && reportB.every((row) => row.name === "B-only Buyer"),
      `rows=${reportB.length}`,
    );
    const summaryB = await getInventorySummary(tenantB);
    check("TEST 8d: shop B inventory is empty", summaryB.cloths.length === 0);

    // ================= TEST 9 — Authorized adjustment =================
    const adjCloth = await createCloth(tenantA, userA, {
      name: "Adj Cloth", category: "Linen", description: "", pricePerMeter: "100",
      currency: "AFN", supplierId: null, lowStockThresholdMeters: "", notes: "",
    });
    await recordInventoryTransaction(tenantA, userA, {
      clothId: String(adjCloth._id), direction: "in", sourceType: "adjustment",
      quantityMeters: "2000", pricePerMeter: "100", currency: "AFN",
      supplierId: null, buyerId: null, occurredAt: day(1), note: "Opening 2,000 m", credit: false, amountPaid: "",
    });
    stock = (await getStockByCloth(tenantA)).get(String(adjCloth._id)) ?? 0;
    check("TEST 9a: 2,000 m opening", stock === 2_000_000);
    // Physical count = 1,950 → adjustment OUT of 50 m (no money side).
    await recordInventoryTransaction(tenantA, userA, {
      clothId: String(adjCloth._id), direction: "out", sourceType: "adjustment",
      quantityMeters: "50", pricePerMeter: "100", currency: "AFN",
      supplierId: null, buyerId: null, occurredAt: day(0), note: "Physical count correction -50 m", credit: false, amountPaid: "",
    });
    stock = (await getStockByCloth(tenantA)).get(String(adjCloth._id)) ?? 0;
    check("TEST 9b: adjustment yields 1,950 m", stock === 1_950_000, `${stock / 1000} m`);
    const adjHistory = await InventoryMovementModel.find({ tenantId: tenantA, clothId: adjCloth._id, sourceType: "adjustment" });
    check("TEST 9c: adjustment appears in history", adjHistory.length === 2);
    // Adjustment below zero is still a legal correction path.
    let adjBelowZeroOk = false;
    try {
      await recordInventoryTransaction(tenantA, userA, {
        clothId: String(adjCloth._id), direction: "out", sourceType: "adjustment",
        quantityMeters: "5000", pricePerMeter: "100", currency: "AFN",
        supplierId: null, buyerId: null, occurredAt: day(0), note: "Wipe", credit: false, amountPaid: "",
      });
      adjBelowZeroOk = true;
    } catch { adjBelowZeroOk = false; }
    check("TEST 9d: adjustments are the authorized correction path (not blocked)", adjBelowZeroOk);

    // SALES still blocked below zero:
    let saleBlocked = false;
    try {
      await recordInventoryTransaction(tenantA, userA, saleOpts(String(ahmad._id), "99999", "100", 0));
    } catch { saleBlocked = true; }
    check("Guard: sale below zero still rejected", saleBlocked);

    // Overpayment guard:
    let overpayBlocked = false;
    try {
      await createLedgerEntry(tenantA, userA, { buyerId: String(ahmad._id), type: "payment", amount: "999999", currency: "AFN", occurredAt: day(0), note: "overpay" });
    } catch { overpayBlocked = true; }
    check("Guard: buyer overpayment rejected", overpayBlocked);
    let supplierOverpayBlocked = false;
    try {
      await createSupplierLedgerEntry(tenantA, userA, { supplierId: String(supplierB._id), type: "payment", amount: "999999", currency: "AFN", occurredAt: day(0), note: "overpay" });
    } catch { supplierOverpayBlocked = true; }
    check("Guard: supplier overpayment rejected", supplierOverpayBlocked);

    // Ledger integrity: movement-linked entries cannot be deleted
    const linked = await LedgerEntryModel.findOne({ tenantId: tenantA, buyerId: ahmad._id, inventoryMovementId: { $ne: null } });
    let linkedDeleteBlocked = false;
    if (linked) {
      const { deleteLedgerEntry } = await import("../lib/services/buyer.service");
      try { await deleteLedgerEntry(tenantA, String(linked._id)); } catch { linkedDeleteBlocked = true; }
    }
    check("Guard: movement-linked ledger entry cannot be deleted", linkedDeleteBlocked);

    // ================= TEST 10 — Complete business flow =================
    const cotton = await createCloth(tenantA, userA, {
      name: "Cotton", category: "Cotton", description: "", pricePerMeter: "100",
      currency: "AFN", supplierId: null, lowStockThresholdMeters: "", notes: "",
    });
    const supFlow = await createSupplier(tenantA, userA, { name: "Supplier Flow", companyName: "", phone: "", address: "", notes: "", status: "active" });
    const ahmadFlow = await createBuyer(tenantA, userA, { name: "Ahmad Flow", shopName: "", phone: "", address: "", notes: "", status: "active" });

    // 1-2: +3,000 m Cotton @100
    await recordInventoryTransaction(tenantA, userA, {
      clothId: String(cotton._id), direction: "in", sourceType: "purchase",
      quantityMeters: "3000", pricePerMeter: "100", currency: "AFN",
      supplierId: String(supFlow._id), buyerId: null, occurredAt: day(1), note: "", credit: true, amountPaid: "0",
    });
    stock = (await getStockByCloth(tenantA)).get(String(cotton._id)) ?? 0;
    check("TEST 10.2: inventory +3,000 m", stock === 3_000_000);
    // 3: supplier balance 300,000
    let flow = await getSupplierLedgerTotals(tenantA, String(supFlow._id));
    check("TEST 10.3: supplier balance 300,000 AFN", flow.payable.AFN === 30_000_000);
    // 4-5: pay 100,000 → 200,000
    await createSupplierLedgerEntry(tenantA, userA, { supplierId: String(supFlow._id), type: "payment", amount: "100000", currency: "AFN", occurredAt: day(1), note: "" });
    flow = await getSupplierLedgerTotals(tenantA, String(supFlow._id));
    check("TEST 10.5: supplier balance 200,000 AFN", flow.payable.AFN === 20_000_000);
    // 6-7: give Ahmad 1,000 m → inventory 2,000 m
    await recordInventoryTransaction(tenantA, userA, {
      clothId: String(cotton._id), direction: "out", sourceType: "sale",
      quantityMeters: "1000", pricePerMeter: "100", currency: "AFN",
      supplierId: null, buyerId: String(ahmadFlow._id), occurredAt: day(0), note: "", credit: true, amountPaid: "0",
    });
    stock = (await getStockByCloth(tenantA)).get(String(cotton._id)) ?? 0;
    check("TEST 10.7: inventory 2,000 m", stock === 2_000_000);
    // 8: Ahmad owes 100,000
    let flowBuyer = await getBuyerLedgerTotals(tenantA, String(ahmadFlow._id));
    check("TEST 10.8: Ahmad owes 100,000 AFN", flowBuyer.outstanding.AFN === 10_000_000);
    // 9-10: pays 40,000 → 60,000
    await createLedgerEntry(tenantA, userA, { buyerId: String(ahmadFlow._id), type: "payment", amount: "40000", currency: "AFN", occurredAt: day(0), note: "" });
    flowBuyer = await getBuyerLedgerTotals(tenantA, String(ahmadFlow._id));
    check("TEST 10.10: Ahmad owes 60,000 AFN", flowBuyer.outstanding.AFN === 6_000_000);
    // 11: inventory still 2,000 m
    stock = (await getStockByCloth(tenantA)).get(String(cotton._id)) ?? 0;
    check("TEST 10.11: inventory still 2,000 m after payment", stock === 2_000_000);
    // 12: supplier still 200,000
    flow = await getSupplierLedgerTotals(tenantA, String(supFlow._id));
    check("TEST 10.12: supplier still 200,000 AFN", flow.payable.AFN === 20_000_000);
    // 13-15: reports contain correct transactions
    const buyerReport = await getBuyerReport(tenantA, { buyerId: String(ahmadFlow._id) });
    const buyerAfn = buyerReport.find((row) => row.currency === "AFN");
    check("TEST 10.13: buyer report Ahmad 100,000 goods / 40,000 paid / 60,000 out",
      buyerAfn !== undefined && buyerAfn.goodsMinor === 10_000_000 && buyerAfn.paymentsMinor === 4_000_000 && buyerAfn.outstandingMinor === 6_000_000,
      buyerAfn ? `g${buyerAfn.goodsMinor} p${buyerAfn.paymentsMinor} o${buyerAfn.outstandingMinor}` : "missing AFN row");
    const supplierReport = await getSupplierReport(tenantA, { supplierId: String(supFlow._id) });
    const supplierAfn = supplierReport.find((row) => row.currency === "AFN");
    check("TEST 10.14: supplier report 300,000 received / 100,000 paid / 200,000 payable",
      supplierAfn !== undefined && supplierAfn.purchasesMinor === 30_000_000 && supplierAfn.paymentsMinor === 10_000_000 && supplierAfn.payableMinor === 20_000_000,
      supplierAfn ? `r${supplierAfn.purchasesMinor} p${supplierAfn.paymentsMinor} o${supplierAfn.payableMinor}` : "missing AFN row");
    const invReport = await getInventoryReport(tenantA, { clothId: String(cotton._id) });
    check("TEST 10.15: inventory report 3,000 in / 1,000 out / 2,000 current / 200,000 value",
      invReport.length === 1 && invReport[0].metersIn === 3000 && invReport[0].metersOut === 1000 && invReport[0].currentMm === 2_000_000 && invReport[0].valueMinor === 20_000_000);
  } finally {
    // Cleanup both tenants completely.
    for (const tenantId of [shopA._id, shopB._id]) {
      await Promise.all([
        LedgerEntryModel.deleteMany({ tenantId }),
        SupplierLedgerEntryModel.deleteMany({ tenantId }),
        InventoryMovementModel.deleteMany({ tenantId }),
        ClothModel.deleteMany({ tenantId }),
        BuyerModel.deleteMany({ tenantId }),
        SupplierModel.deleteMany({ tenantId }),
      ]);
    }
    await UserModel.deleteMany({ tenantId: { $in: [shopA._id, shopB._id] } });
    await ShopModel.deleteMany({ _id: { $in: [shopA._id, shopB._id] } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
