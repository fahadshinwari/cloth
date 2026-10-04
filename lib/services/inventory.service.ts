import "server-only";

import mongoose from "mongoose";
import {
  BuyerModel,
  ClothModel,
  InventoryMovementModel,
  LedgerEntryModel,
  ShopModel,
  SupplierLedgerEntryModel,
  SupplierModel,
  type ClothDocument,
  type InventoryMovementDocument,
} from "../models";
import { connectToDatabase } from "../mongodb";
import { toMinorUnits } from "../money";
import { MM_PER_METER } from "../measure";
import {
  INVENTORY_DIRECTION,
  INVENTORY_SOURCE_TYPE,
  LEDGER_ENTRY_TYPE,
  SUPPLIER_LEDGER_ENTRY_TYPE,
  type InventorySourceType,
} from "../constants";
import type { ClothInput, InventoryTransactionInput } from "../validation";

export class InventoryServiceError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "InventoryServiceError";
    this.field = field;
  }
}

function assertTenantId(tenantId: string): void {
  if (!/^[a-f\d]{24}$/i.test(tenantId)) {
    throw new InventoryServiceError("Invalid tenant.");
  }
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

// ---------------------------------------------------------------------------
// Cloths (catalog) — stock is NEVER stored here, only derived from movements
// ---------------------------------------------------------------------------

export async function listCloths(tenantId: string): Promise<ClothDocument[]> {
  assertTenantId(tenantId);
  await connectToDatabase();
  return ClothModel.find({ tenantId: toObjectId(tenantId) }).sort({ name: 1 });
}

export async function getClothById(
  tenantId: string,
  clothId: string,
): Promise<ClothDocument | null> {
  assertTenantId(tenantId);
  if (!/^[a-f\d]{24}$/i.test(clothId)) return null;
  await connectToDatabase();
  // Tenant filter is always applied — an id alone can never leak another tenant's cloth.
  return ClothModel.findOne({ _id: toObjectId(clothId), tenantId: toObjectId(tenantId) });
}

export async function countCloths(tenantId: string): Promise<number> {
  assertTenantId(tenantId);
  await connectToDatabase();
  return ClothModel.countDocuments({ tenantId: toObjectId(tenantId) });
}

export async function createCloth(
  tenantId: string,
  userId: string,
  input: ClothInput,
): Promise<ClothDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const duplicate = await ClothModel.findOne({
    tenantId: toObjectId(tenantId),
    name: input.name,
  });
  if (duplicate) {
    throw new InventoryServiceError("A cloth with this name already exists.", "name");
  }

  if (input.supplierId) {
    const supplier = await SupplierModel.findById(input.supplierId);
    if (!supplier || supplier.tenantId.toString() !== tenantId) {
      throw new InventoryServiceError("Supplier not found.", "supplierId");
    }
  }

  const pricePerMeterMinor = toMinorUnits(input.pricePerMeter, input.currency);
  if (pricePerMeterMinor === null || pricePerMeterMinor <= 0) {
    throw new InventoryServiceError("Invalid price per meter.", "pricePerMeter");
  }

  const lowStockThresholdMm =
    input.lowStockThresholdMeters.trim() === ""
      ? null
      : Math.round(Number(input.lowStockThresholdMeters.replace(/,/g, "")) * 1000);

  return ClothModel.create({
    tenantId: toObjectId(tenantId),
    name: input.name,
    category: input.category,
    description: input.description,
    pricePerMeterMinor,
    currency: input.currency,
    supplierId: input.supplierId ? toObjectId(input.supplierId) : null,
    lowStockThresholdMm: lowStockThresholdMm !== null && Number.isSafeInteger(lowStockThresholdMm) && lowStockThresholdMm >= 0
      ? lowStockThresholdMm
      : null,
    notes: input.notes,
    createdBy: toObjectId(userId),
    updatedBy: toObjectId(userId),
  });
}

export async function updateCloth(
  tenantId: string,
  clothId: string,
  userId: string,
  input: ClothInput,
): Promise<ClothDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const cloth = await getClothById(tenantId, clothId);
  if (!cloth) throw new InventoryServiceError("Cloth not found.");

  const duplicate = await ClothModel.findOne({
    tenantId: toObjectId(tenantId),
    name: input.name,
    _id: { $ne: cloth._id },
  });
  if (duplicate) {
    throw new InventoryServiceError("A cloth with this name already exists.", "name");
  }

  if (input.supplierId) {
    const supplier = await SupplierModel.findById(input.supplierId);
    if (!supplier || supplier.tenantId.toString() !== tenantId) {
      throw new InventoryServiceError("Supplier not found.", "supplierId");
    }
  }

  const pricePerMeterMinor = toMinorUnits(input.pricePerMeter, input.currency);
  if (pricePerMeterMinor === null || pricePerMeterMinor <= 0) {
    throw new InventoryServiceError("Invalid price per meter.", "pricePerMeter");
  }

  const lowStockThresholdMm =
    input.lowStockThresholdMeters.trim() === ""
      ? null
      : Math.round(Number(input.lowStockThresholdMeters.replace(/,/g, "")) * 1000);

  cloth.name = input.name;
  cloth.category = input.category;
  cloth.description = input.description;
  cloth.pricePerMeterMinor = pricePerMeterMinor;
  cloth.currency = input.currency;
  cloth.supplierId = input.supplierId ? toObjectId(input.supplierId) : null;
  cloth.lowStockThresholdMm =
    lowStockThresholdMm !== null && Number.isSafeInteger(lowStockThresholdMm) && lowStockThresholdMm >= 0
      ? lowStockThresholdMm
      : null;
  cloth.notes = input.notes;
  cloth.updatedBy = toObjectId(userId);
  await cloth.save();
  return cloth;
}

/**
 * Current stock per cloth, aggregated from movements — the ONLY source of
 * stock truth. Keyed by cloth id, value in integer millimeters.
 */
export async function getStockByCloth(
  tenantId: string,
): Promise<Map<string, number>> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const rows = await InventoryMovementModel.aggregate<{
    _id: mongoose.Types.ObjectId;
    signed: number;
  }>([
    { $match: { tenantId: toObjectId(tenantId) } },
    {
      $group: {
        _id: "$clothId",
        signed: {
          $sum: {
            $cond: [{ $eq: ["$direction", INVENTORY_DIRECTION.IN] }, "$quantityMm", { $multiply: ["$quantityMm", -1] }],
          },
        },
      },
    },
  ]);

  return new Map(rows.map((row) => [row._id.toString(), row.signed]));
}

// ---------------------------------------------------------------------------
// Movement history
// ---------------------------------------------------------------------------

export async function listMovements(
  tenantId: string,
  opts: { clothId?: string; supplierId?: string; buyerId?: string; limit?: number } = {},
): Promise<InventoryMovementDocument[]> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const query: Record<string, unknown> = { tenantId: toObjectId(tenantId) };
  if (opts.clothId) {
    if (!/^[a-f\d]{24}$/i.test(opts.clothId)) return [];
    query.clothId = toObjectId(opts.clothId);
  }
  if (opts.supplierId) query.supplierId = toObjectId(opts.supplierId);
  if (opts.buyerId) query.buyerId = toObjectId(opts.buyerId);

  return InventoryMovementModel.find(query)
    .sort({ occurredAt: -1, createdAt: -1 })
    .limit(opts.limit ?? 500);
}

// ---------------------------------------------------------------------------
// Combined inventory + accounting transactions
//
// A purchase  = inventory IN  + supplier ledger `purchase` (if credit) − payments
// A sale      = inventory OUT + buyer ledger `goods`     (if credit) − payments
// A payment   = ledger only; it NEVER moves physical stock.
// ---------------------------------------------------------------------------

interface MovementCore {
  tenantId: mongoose.Types.ObjectId;
  clothId: mongoose.Types.ObjectId;
  direction: "in" | "out";
  quantityMm: number;
  pricePerMeterMinor: number;
  totalValueMinor: number;
  currency: "AFN" | "USD";
  sourceType: InventorySourceType;
  supplierId: mongoose.Types.ObjectId | null;
  buyerId: mongoose.Types.ObjectId | null;
  occurredAt: Date;
  note: string;
  createdBy: mongoose.Types.ObjectId;
}

/**
 * Rejects SALE movements that would drive stock below zero (unless the tenant
 * opted in via the admin flag). ADJUSTMENT movements are deliberately exempt:
 * an adjustment IS the authorized correction path for stock errors.
 */
async function assertStockAvailable(
  tenantId: string,
  clothId: string,
  requestedMm: number,
): Promise<void> {
  const shop = await ShopModel.findById(tenantId).select("allowNegativeInventory").lean();
  if (shop?.allowNegativeInventory) return;

  const stock = await getStockByCloth(tenantId);
  const available = stock.get(clothId) ?? 0;
  if (requestedMm > available) {
    throw new InventoryServiceError(
      `Not enough stock: ${available / MM_PER_METER} m available, ${requestedMm / MM_PER_METER} m requested. Use an ADJUSTMENT transaction to correct stock.`,
      "quantityMeters",
    );
  }
}

/**
 * Records a full business transaction in one coherent write:
 * 1. the inventory movement (stock),
 * 2. the money side — supplier payable (purchase) or buyer receivable (sale),
 * 3. an optional immediate payment that reduces the new balance.
 */
export async function recordInventoryTransaction(
  tenantId: string,
  userId: string,
  input: InventoryTransactionInput,
): Promise<{ movementId: string; ledgerEntryId: string | null }> {
  assertTenantId(tenantId);
  await connectToDatabase();

  if (input.sourceType === INVENTORY_SOURCE_TYPE.PURCHASE && input.direction !== "in") {
    throw new InventoryServiceError("Purchases must be inventory IN.", "direction");
  }
  if (input.sourceType === INVENTORY_SOURCE_TYPE.SALE && input.direction !== "out") {
    throw new InventoryServiceError("Sales must be inventory OUT.", "direction");
  }

  const cloth = await getClothById(tenantId, input.clothId);
  if (!cloth) {
    throw new InventoryServiceError("Cloth not found.", "clothId");
  }

  // Cross-tenant references are rejected even if the ids are well-formed.
  if (input.supplierId) {
    const supplier = await SupplierModel.findById(input.supplierId);
    if (!supplier || supplier.tenantId.toString() !== tenantId) {
      throw new InventoryServiceError("Supplier not found.", "supplierId");
    }
  }
  if (input.buyerId) {
    const buyer = await BuyerModel.findById(input.buyerId);
    if (!buyer || buyer.tenantId.toString() !== tenantId) {
      throw new InventoryServiceError("Buyer not found.", "buyerId");
    }
  }

  const quantityMm = Math.round(Number(input.quantityMeters.replace(/,/g, "")) * MM_PER_METER);
  if (!Number.isSafeInteger(quantityMm) || quantityMm <= 0) {
    throw new InventoryServiceError("Invalid quantity.", "quantityMeters");
  }

  const pricePerMeterMinor = toMinorUnits(input.pricePerMeter, input.currency);
  if (pricePerMeterMinor === null || pricePerMeterMinor <= 0) {
    throw new InventoryServiceError("Invalid price per meter.", "pricePerMeter");
  }

  // Total value = meters × price per meter, in exact integer minor units.
  const totalValueMinor = Math.round((quantityMm / MM_PER_METER) * pricePerMeterMinor);
  if (!Number.isSafeInteger(totalValueMinor) || totalValueMinor <= 0) {
    throw new InventoryServiceError("Invalid total value.", "quantityMeters");
  }

  // Negative-inventory guard applies to SALES only. Adjustments are the
  // explicit correction path and may legitimately push stock down (TEST 9).
  if (
    input.direction === INVENTORY_DIRECTION.OUT &&
    input.sourceType === INVENTORY_SOURCE_TYPE.SALE
  ) {
    await assertStockAvailable(tenantId, String(cloth._id), quantityMm);
  }

  const amountPaidMinor =
    input.amountPaid.trim() === "" ? 0 : toMinorUnits(input.amountPaid, input.currency);
  if (amountPaidMinor === null || amountPaidMinor < 0) {
    throw new InventoryServiceError("Invalid paid amount.", "amountPaid");
  }

  const movementCore: MovementCore = {
    tenantId: toObjectId(tenantId),
    clothId: cloth._id,
    direction: input.direction,
    quantityMm,
    pricePerMeterMinor,
    totalValueMinor,
    currency: input.currency as "AFN" | "USD",
    sourceType: input.sourceType,
    supplierId: input.supplierId ? toObjectId(input.supplierId) : null,
    buyerId: input.buyerId ? toObjectId(input.buyerId) : null,
    occurredAt: input.occurredAt,
    note: input.note,
    createdBy: toObjectId(userId),
  };

  let ledgerEntryId: string | null = null;

  if (input.sourceType === INVENTORY_SOURCE_TYPE.PURCHASE) {
    // Purchases: inventory IN + supplier ledger purchase entry for the FULL
    // value (the ledger is the complete history of what was received), plus a
    // separate payment entry for anything paid now. The payable is derived
    // from these entries — never stored.
    if (!movementCore.supplierId) {
      throw new InventoryServiceError("A supplier is required for purchases.", "supplierId");
    }
    const supplierId = movementCore.supplierId;

    const movement = await InventoryMovementModel.create(movementCore);

    const purchaseEntry = await SupplierLedgerEntryModel.create({
      tenantId: toObjectId(tenantId),
      supplierId,
      type: SUPPLIER_LEDGER_ENTRY_TYPE.PURCHASE,
      amountMinor: totalValueMinor,
      currency: input.currency,
      occurredAt: input.occurredAt,
      note: input.note || `Purchase: ${quantityMm / MM_PER_METER} m of ${cloth.name}`,
      inventoryMovementId: movement._id,
      createdBy: toObjectId(userId),
    });

    if (amountPaidMinor > 0) {
      await SupplierLedgerEntryModel.create({
        tenantId: toObjectId(tenantId),
        supplierId,
        type: SUPPLIER_LEDGER_ENTRY_TYPE.PAYMENT,
        amountMinor: amountPaidMinor,
        currency: input.currency,
        occurredAt: input.occurredAt,
        note: input.note || `Payment with purchase of ${cloth.name}`,
        inventoryMovementId: movement._id,
        createdBy: toObjectId(userId),
      });
    }
    ledgerEntryId = String(purchaseEntry._id);

    return { movementId: String(movement._id), ledgerEntryId };
  }

  if (input.sourceType === INVENTORY_SOURCE_TYPE.SALE) {
    // Sales: inventory OUT + buyer ledger goods entry for the FULL value,
    // plus a separate payment entry for anything collected now. The
    // outstanding is derived from these entries — never stored.
    if (!movementCore.buyerId) {
      throw new InventoryServiceError("A buyer is required for sales.", "buyerId");
    }
    const buyerId = movementCore.buyerId;

    const movement = await InventoryMovementModel.create(movementCore);

    const goodsEntry = await LedgerEntryModel.create({
      tenantId: toObjectId(tenantId),
      buyerId,
      type: LEDGER_ENTRY_TYPE.GOODS,
      amountMinor: totalValueMinor,
      currency: input.currency,
      occurredAt: input.occurredAt,
      note: input.note || `Sale: ${quantityMm / MM_PER_METER} m of ${cloth.name}`,
      inventoryMovementId: movement._id,
      createdBy: toObjectId(userId),
    });

    if (amountPaidMinor > 0) {
      await LedgerEntryModel.create({
        tenantId: toObjectId(tenantId),
        buyerId,
        type: LEDGER_ENTRY_TYPE.PAYMENT,
        amountMinor: amountPaidMinor,
        currency: input.currency,
        occurredAt: input.occurredAt,
        note: input.note || `Payment with sale of ${cloth.name}`,
        inventoryMovementId: movement._id,
        createdBy: toObjectId(userId),
      });
    }
    ledgerEntryId = String(goodsEntry._id);

    return { movementId: String(movement._id), ledgerEntryId };
  }

  // Adjustments: inventory movement only — no money side.
  const movement = await InventoryMovementModel.create(movementCore);
  return { movementId: String(movement._id), ledgerEntryId: null };
}

// ---------------------------------------------------------------------------
// Aggregations — value and meters per cloth, per currency, never merged
// ---------------------------------------------------------------------------

export interface ClothStockView {
  cloth: ClothDocument;
  /** Current stock in integer millimeters (derived from movements). */
  stockMm: number;
  /** stock (m) × price per meter, in integer minor units. */
  valueMinor: number;
  /** true when stock is at/below the cloth's low-stock threshold. */
  low: boolean;
}

export interface InventorySummary {
  cloths: ClothStockView[];
  totalMetersMm: number;
  valueByCurrency: { AFN: number; USD: number; display: Record<"AFN" | "USD", number> };
  /** Cloths at/below their low-stock threshold (for dashboard warnings). */
  lowStock: ClothStockView[];
}

export async function getInventorySummary(tenantId: string): Promise<InventorySummary> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const [cloths, stock] = await Promise.all([listCloths(tenantId), getStockByCloth(tenantId)]);

  const views: ClothStockView[] = cloths.map((cloth) => {
    const stockMm = stock.get(String(cloth._id)) ?? 0;
    const valueMinor = Math.round((stockMm / MM_PER_METER) * cloth.pricePerMeterMinor);
    const threshold = cloth.lowStockThresholdMm ?? null;
    const low = threshold !== null && stockMm <= threshold;
    return { cloth, stockMm, valueMinor, low };
  });

  const valueByCurrency = { AFN: 0, USD: 0 };
  let totalMetersMm = 0;
  for (const view of views) {
    totalMetersMm += view.stockMm;
    if (view.cloth.currency === "AFN") valueByCurrency.AFN += view.valueMinor;
    else valueByCurrency.USD += view.valueMinor;
  }

  return {
    cloths: views,
    lowStock: views.filter((view) => view.low),
    totalMetersMm,
    valueByCurrency: {
      AFN: valueByCurrency.AFN,
      USD: valueByCurrency.USD,
      display: {
        AFN: valueByCurrency.AFN / 100,
        USD: valueByCurrency.USD / 100,
      },
    },
  };
}
