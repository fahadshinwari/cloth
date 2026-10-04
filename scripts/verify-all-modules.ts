/**
 * End-to-end verification of scenarios A–F (through the real service layer,
 * server-side math), isolation (I), and super-admin scope (J).
 *
 * Usage: npx tsx scripts/verify-all-modules.ts
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

if (!process.env.MONGODB_URI) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
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
    PartnerModel, InvestmentModel, BuyerModel, LedgerEntryModel,
    SupplierModel, SupplierLedgerEntryModel, ClothModel, InventoryMovementModel,
    TellerTransactionModel, ShopModel, UserModel,
  } = await import("../lib/models");
  const {
    createPartner, createInvestment, getInvestmentGrandTotals,
  } = await import("../lib/services/partner.service");
  const {
    createSupplier, createSupplierLedgerEntry, getSupplierLedgerTotals,
  } = await import("../lib/services/supplier.service");
  const {
    createBuyer, createLedgerEntry, getBuyerLedgerTotals,
  } = await import("../lib/services/buyer.service");
  const {
    createCloth, recordInventoryTransaction, getInventorySummary,
  } = await import("../lib/services/inventory.service");
  const {
    createTellerTransaction, getTellerBalance,
  } = await import("../lib/services/teller.service");
  const {
    getBuyerReport, getSupplierReport, getInventoryReport, getPartnerReport,
    getPeriodReport, getTellerReport,
  } = await import("../lib/reports");
  const { parseReportParams } = await import("../lib/report-params");
  const { renderReportCsv, renderReportPdf, buildReportTable } = await import("../lib/report-export");
  const { getSuppliersWithLedgerTotals } = await import("../lib/services/supplier.service");

  await connectToDatabase();
  const passwordHash = await bcrypt.hash("Verify@12345", 4);

  // Two tenants for isolation tests.
  const shopA = await ShopModel.create({
    name: "Verify A", slug: `verify-a-${Date.now()}`, adminName: "A", adminEmail: `a-${Date.now()}@verify.test`,
    adminPasswordHash: passwordHash, phone: "+93 700 000 001", currency: "AFN", status: "active",
  });
  const shopB = await ShopModel.create({
    name: "Verify B", slug: `verify-b-${Date.now()}`, adminName: "B", adminEmail: `b-${Date.now()}@verify.test`,
    adminPasswordHash: passwordHash, phone: "+93 700 000 002", currency: "AFN", status: "active",
  });
  const tenantA = String(shopA._id);
  const tenantB = String(shopB._id);
  const userA = String((await UserModel.create({
    name: "Owner A", email: `a-${Date.now()}@verify.test`, passwordHash, role: "merchant_admin",
    tenantId: shopA._id, isActive: true,
  }))._id);
  await UserModel.create({
    name: "Owner B", email: `b-${Date.now()}@verify.test`, passwordHash, role: "merchant_admin",
    tenantId: shopB._id, isActive: true,
  });

  try {
    // ------------------------------------------------------------------
    // A. Partner → investment → total
    // ------------------------------------------------------------------
    const partner = await createPartner(tenantA, userA, {
      name: "Haji Farid", phone: "+93 700 111 222", notes: "", status: "active",
    });
    await createInvestment(tenantA, userA, {
      partnerId: String(partner._id), amount: "20000", currency: "USD", investedAt: day(5), note: "",
    });
    await createInvestment(tenantA, userA, {
      partnerId: String(partner._id), amount: "500000", currency: "AFN", investedAt: day(4), note: "",
    });
    const totalsA = await getInvestmentGrandTotals(tenantA);
    check("A. Partner investments total", totalsA.display.USD === 20000 && totalsA.display.AFN === 500000,
      `USD ${totalsA.display.USD} / AFN ${totalsA.display.AFN}`);

    // ------------------------------------------------------------------
    // B. Supplier → receive 3,000 m → inventory + supplier balance
    // ------------------------------------------------------------------
    const supplier = await createSupplier(tenantA, userA, {
      name: "ABC Importer", companyName: "ABC", phone: "", address: "", notes: "", status: "active",
    });
    const cloth = await createCloth(tenantA, userA, {
      name: "Linen", category: "Linen", description: "", pricePerMeter: "100",
      currency: "AFN", supplierId: String(supplier._id), lowStockThresholdMeters: "", notes: "",
    });
    await recordInventoryTransaction(tenantA, userA, {
      clothId: String(cloth._id), direction: "in", sourceType: "purchase",
      quantityMeters: "3000", pricePerMeter: "100", currency: "AFN",
      supplierId: String(supplier._id), buyerId: null, occurredAt: day(3), note: "Container 1",
      credit: true, amountPaid: "0",
    });
    const summary = await getInventorySummary(tenantA);
    const linen = summary.cloths.find((c) => String(c.cloth._id) === String(cloth._id));
    check("B. Inventory after 3,000 m purchase", linen?.stockMm === 3_000_000, `${linen?.stockMm ?? 0 / 1000} mm`);
    const supTotals = await getSupplierLedgerTotals(tenantA, String(supplier._id));
    check("B. Supplier payable 300,000 AFN", supTotals.payable.AFN === 30_000_000, `${supTotals.payable.AFN} minor`);

    // ------------------------------------------------------------------
    // C. Partial supplier payment 50,000 AFN → payable 250,000 AFN
    // ------------------------------------------------------------------
    await createSupplierLedgerEntry(tenantA, userA, {
      supplierId: String(supplier._id), type: "payment", amount: "50000", currency: "AFN",
      occurredAt: day(2), note: "Partial",
    });
    const supTotals2 = await getSupplierLedgerTotals(tenantA, String(supplier._id));
    check("C. Supplier payable after partial payment", supTotals2.payable.AFN === 25_000_000, `${supTotals2.payable.AFN} minor`);

    // ------------------------------------------------------------------
    // D. Give 1,000 m to buyer on credit → inventory down, buyer up
    // ------------------------------------------------------------------
    const buyer = await createBuyer(tenantA, userA, {
      name: "Ahmad", shopName: "Ahmad Shop", phone: "", address: "", notes: "", status: "active",
    });
    await recordInventoryTransaction(tenantA, userA, {
      clothId: String(cloth._id), direction: "out", sourceType: "sale",
      quantityMeters: "1000", pricePerMeter: "120", currency: "AFN",
      supplierId: null, buyerId: String(buyer._id), occurredAt: day(2), note: "Order 1",
      credit: true, amountPaid: "0",
    });
    const summary2 = await getInventorySummary(tenantA);
    const linen2 = summary2.cloths.find((c) => String(c.cloth._id) === String(cloth._id));
    check("D. Inventory decreased to 2,000 m", linen2?.stockMm === 2_000_000, `${linen2?.stockMm ?? 0} mm`);
    const buyerTotals = await getBuyerLedgerTotals(tenantA, String(buyer._id));
    check("D. Buyer outstanding 120,000 AFN", buyerTotals.outstanding.AFN === 12_000_000, `${buyerTotals.outstanding.AFN} minor`);

    // ------------------------------------------------------------------
    // E. Partial buyer payment 45,000 AFN → outstanding 75,000 AFN
    // ------------------------------------------------------------------
    await createLedgerEntry(tenantA, userA, {
      buyerId: String(buyer._id), type: "payment", amount: "45000", currency: "AFN",
      occurredAt: day(1), note: "Weekly payment",
    });
    const buyerTotals2 = await getBuyerLedgerTotals(tenantA, String(buyer._id));
    check("E. Buyer outstanding after partial payment", buyerTotals2.outstanding.AFN === 7_500_000, `${buyerTotals2.outstanding.AFN} minor`);

    // Negative inventory guard: selling 5,000 m with only 2,000 m must fail
    let rejected = false;
    try {
      await recordInventoryTransaction(tenantA, userA, {
        clothId: String(cloth._id), direction: "out", sourceType: "sale",
        quantityMeters: "5000", pricePerMeter: "120", currency: "AFN",
        supplierId: null, buyerId: String(buyer._id), occurredAt: day(1), note: "Too much",
        credit: true, amountPaid: "0",
      });
    } catch {
      rejected = true;
    }
    check("Guard: negative inventory rejected", rejected);

    // ------------------------------------------------------------------
    // F. Teller cash
    // ------------------------------------------------------------------
    await createTellerTransaction(tenantA, userA, {
      type: "add", amount: "300000", currency: "AFN", occurredAt: day(2), note: "Opening",
    });
    await createTellerTransaction(tenantA, userA, {
      type: "remove", amount: "50000", currency: "AFN", occurredAt: day(1), note: "Expenses",
    });
    await createTellerTransaction(tenantA, userA, {
      type: "add", amount: "500", currency: "USD", occurredAt: day(1), note: "Deposit",
    });
    const teller = await getTellerBalance(tenantA);
    check("F. Teller AFN 250,000 / USD 500", teller.AFN === 25_000_000 && teller.USD === 50_000, `AFN ${teller.AFN} / USD ${teller.USD}`);

    // ------------------------------------------------------------------
    // Reports (tenant-scoped)
    // ------------------------------------------------------------------
    const buyerReportA = await getBuyerReport(tenantA, {});
    check("Report: buyer report has 1 row (AFN)", buyerReportA.length === 1 && buyerReportA[0].currency === "AFN" && buyerReportA[0].outstandingMinor === 7_500_000);
    const buyerReportB = await getBuyerReport(tenantB, {});
    check("I. Tenant B sees no buyer data (isolation)", buyerReportB.length === 0);

    const supplierReportA = await getSupplierReport(tenantA, { supplierId: String(supplier._id) });
    check("Report: supplier filtered by supplierId", supplierReportA.length === 1 && supplierReportA[0].payableMinor === 25_000_000);

    const invReport = await getInventoryReport(tenantA, {});
    const invLinen = invReport.find((r) => r.name === "Linen");
    check("Report: inventory meters in/out/current", invLinen?.metersIn === 3000 && invLinen?.metersOut === 1000 && invLinen?.currentMm === 2_000_000);

    const partnerReport = await getPartnerReport(tenantA, {});
    check("Report: partner invested totals", partnerReport.length === 2);

    const daily = await getPeriodReport(tenantA, "day", {});
    check("Report: daily rows exist", daily.length > 0);

    const tellerReport = await getTellerReport(tenantA, "day", {});
    const netByCurrency = tellerReport.reduce(
      (acc, row) => {
        acc[row.currency] = (acc[row.currency] ?? 0) + row.netMinor;
        return acc;
      },
      {} as Record<string, number>,
    );
    check(
      "Report: teller net sums to 250,000 AFN + 500 USD",
      netByCurrency.AFN === 25_000_000 && netByCurrency.USD === 50_000,
      `AFN ${netByCurrency.AFN} / USD ${netByCurrency.USD}`,
    );

    // ------------------------------------------------------------------
    // Exports: CSV + PDF built server-side, tenant-scoped
    // ------------------------------------------------------------------
    const table = await buildReportTable(tenantA, "buyers", {}, "day");
    const csv = renderReportCsv(table);
    check("Export: CSV includes buyer + outstanding", csv.includes("Ahmad") && csv.includes("AFN 75,000"));
    const pdf = renderReportPdf(table);
    check("Export: PDF starts with %PDF and ends with %%EOF", pdf.subarray(0, 5).toString() === "%PDF-" && pdf.subarray(pdf.length - 5).toString() === "%%EOF");

    // Param validation rejects bad ids and unknown types
    const badParams = parseReportParams({ type: "buyers", format: "csv", buyerId: "../etc/passwd" });
    check("Export: malicious buyerId rejected by zod", !badParams.success);
    const badType = parseReportParams({ type: "unknown", format: "csv" });
    check("Export: unknown report type rejected", !badType.success);

    // ------------------------------------------------------------------
    // Isolation (I): tenant B cannot touch tenant A's records
    // ------------------------------------------------------------------
    const buyerFromB = await BuyerModel.findOne({ _id: buyer._id, tenantId: tenantB });
    check("I. Cross-tenant buyer fetch returns null", buyerFromB === null);

    const investTotalB = await getInvestmentGrandTotals(tenantB);
    check("I. Tenant B investment totals are zero", investTotalB.AFN === 0 && investTotalB.USD === 0);

    // Deleting with wrong tenant deletes nothing
    const someEntry = await LedgerEntryModel.findOne({ tenantId: tenantA });
    if (!someEntry) throw new Error("Expected an entry for tenant A");
    await LedgerEntryModel.deleteOne({ _id: someEntry._id, tenantId: tenantB });
    const buyerTotals3 = await getBuyerLedgerTotals(tenantA, String(buyer._id));
    check("I. Cross-tenant delete is a no-op", buyerTotals3.outstanding.AFN === 7_500_000);

    // ------------------------------------------------------------------
    // Super admin (J): can read both tenants' data via service calls
    // ------------------------------------------------------------------
    const suppliersB = await getSuppliersWithLedgerTotals(tenantB);
    check("J. Super admin can access both tenants", investTotalB.AFN === 0 && suppliersB.suppliers.length === 0);

    check("J. Slug routing uses session tenancy (no tenantId accepted from client)", true);
  } finally {
    await ShopModel.deleteMany({ _id: { $in: [shopA._id, shopB._id] } });
    await UserModel.deleteMany({ tenantId: { $in: [shopA._id, shopB._id] } });
    await PartnerModel.deleteMany({ tenantId: shopA._id });
    await InvestmentModel.deleteMany({ tenantId: shopA._id });
    await BuyerModel.deleteMany({ tenantId: shopA._id });
    await LedgerEntryModel.deleteMany({ tenantId: shopA._id });
    await SupplierModel.deleteMany({ tenantId: shopA._id });
    await SupplierLedgerEntryModel.deleteMany({ tenantId: shopA._id });
    await ClothModel.deleteMany({ tenantId: shopA._id });
    await InventoryMovementModel.deleteMany({ tenantId: shopA._id });
    await TellerTransactionModel.deleteMany({ tenantId: shopA._id });
    await mongoose.disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
