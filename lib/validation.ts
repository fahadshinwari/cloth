import {
  BUYER_STATUSES,
  CURRENCIES,
  DEFAULT_LOCALE,
  INVENTORY_SOURCE_TYPES,
  LEDGER_ENTRY_TYPES,
  LOCALES,
  PARTNER_STATUSES,
  REMINDER_SCHEDULES,
  RESERVED_SLUGS,
  SHOP_STATUSES,
  SHOP_STATUS,
  SLUG_REGEX,
  SUPPLIER_LEDGER_ENTRY_TYPES,
  SUPPLIER_STATUSES,
  TELLER_TRANSACTION_TYPES,
  USER_ROLES,
  type Currency,
  type Locale,
} from "./constants";
import { isCurrency as isCurrencyValue, toMinorUnits } from "./money";
import { toMillimeters } from "./measure";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string> };

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface ShopInput {
  name: string;
  slug: string;
  adminName: string;
  adminEmail: string;
  adminPassword?: string;
  phone: string;
  currency: Currency;
  status: (typeof SHOP_STATUS)[keyof typeof SHOP_STATUS];
}

export function validateShopInput(
  raw: Record<string, unknown>,
  opts: { requirePassword: boolean },
): ValidationResult<ShopInput> {
  const errors: Record<string, string> = {};

  const name = String(raw.name ?? "").trim();
  if (name.length < 2 || name.length > 120) {
    errors.name = "Shop name must be 2–120 characters.";
  }

  const slug = slugify(String(raw.slug ?? ""));
  if (!SLUG_REGEX.test(slug)) {
    errors.slug = "Slug may only contain lowercase letters, numbers and hyphens.";
  } else if (slug.length < 2 || slug.length > 60) {
    errors.slug = "Slug must be 2–60 characters.";
  } else if ((RESERVED_SLUGS as readonly string[]).includes(slug)) {
    errors.slug = "This slug is reserved by the platform.";
  }

  const adminName = String(raw.adminName ?? "").trim();
  if (adminName.length < 2) {
    errors.adminName = "Admin name is required.";
  }

  const adminEmail = String(raw.adminEmail ?? "").trim().toLowerCase();
  if (!isValidEmail(adminEmail)) {
    errors.adminEmail = "A valid admin email is required.";
  }

  const adminPassword = String(raw.adminPassword ?? "");
  if (opts.requirePassword && adminPassword.length < 8) {
    errors.adminPassword = "Password must be at least 8 characters.";
  } else if (!opts.requirePassword && adminPassword.length > 0 && adminPassword.length < 8) {
    errors.adminPassword = "Password must be at least 8 characters.";
  }

  const phone = String(raw.phone ?? "").trim();
  if (phone.length < 7) {
    errors.phone = "A valid phone number is required.";
  }

  const currency = String(raw.currency ?? "") as Currency;
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    errors.currency = "Currency must be AFN or USD.";
  }

  const status = String(raw.status ?? SHOP_STATUS.ACTIVE);
  if (!(SHOP_STATUSES as readonly string[]).includes(status)) {
    errors.status = "Status must be active or inactive.";
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name,
      slug,
      adminName,
      adminEmail,
      adminPassword: adminPassword || undefined,
      phone,
      currency,
      status: status as ShopInput["status"],
    },
  };
}

export interface CredentialsInput {
  email: string;
  password: string;
}

export function validateCredentials(raw: Record<string, unknown>): ValidationResult<CredentialsInput> {
  const errors: Record<string, string> = {};

  const email = String(raw.email ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    errors.email = "A valid email is required.";
  }

  const password = String(raw.password ?? "");
  if (password.length < 1) {
    errors.password = "Password is required.";
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: { email, password } };
}

export interface ResetCredentialsInput {
  adminEmail?: string;
  adminPassword?: string;
}

export function validateResetCredentials(
  raw: Record<string, unknown>,
): ValidationResult<ResetCredentialsInput> {
  const errors: Record<string, string> = {};

  const adminEmail = String(raw.adminEmail ?? "").trim().toLowerCase();
  if (adminEmail && !isValidEmail(adminEmail)) {
    errors.adminEmail = "A valid email is required.";
  }

  const adminPassword = String(raw.adminPassword ?? "");
  if (adminPassword && adminPassword.length < 8) {
    errors.adminPassword = "Password must be at least 8 characters.";
  }

  if (!adminEmail && !adminPassword) {
    errors.adminPassword = errors.adminPassword ?? "Provide a new email or a new password.";
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      adminEmail: adminEmail || undefined,
      adminPassword: adminPassword || undefined,
    },
  };
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function toLocale(value: string | undefined | null): Locale {
  return value && isLocale(value) ? value : DEFAULT_LOCALE;
}

export function assertNeverRole(role: string): void {
  if (!(USER_ROLES as readonly string[]).includes(role)) {
    throw new Error(`Unknown role: ${role}`);
  }
}

// ---------------------------------------------------------------------------
// Partners & investments (Module 1)
// ---------------------------------------------------------------------------

export interface PartnerInput {
  name: string;
  phone: string;
  notes: string;
  status: (typeof PARTNER_STATUSES)[number];
}

export function validatePartnerInput(raw: Record<string, unknown>): ValidationResult<PartnerInput> {
  const errors: Record<string, string> = {};

  const name = String(raw.name ?? "").trim();
  if (name.length < 2 || name.length > 120) {
    errors.name = "Partner name must be 2–120 characters.";
  }

  const phone = String(raw.phone ?? "").trim();
  if (phone && phone.length < 7) {
    errors.phone = "Phone must be at least 7 characters, or left blank.";
  }

  const notes = String(raw.notes ?? "").trim();
  if (notes.length > 2000) {
    errors.notes = "Notes must be at most 2000 characters.";
  }

  const status = String(raw.status ?? "active").trim();
  if (!(PARTNER_STATUSES as readonly string[]).includes(status)) {
    errors.status = "Status must be active or inactive.";
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name,
      phone,
      notes,
      status: status as PartnerInput["status"],
    },
  };
}

export interface InvestmentInput {
  partnerId: string;
  amount: string;
  currency: Currency;
  investedAt: Date;
  note: string;
}

export function validateInvestmentInput(raw: Record<string, unknown>): ValidationResult<InvestmentInput> {
  const errors: Record<string, string> = {};

  const partnerId = String(raw.partnerId ?? "").trim();
  if (!/^[a-f\d]{24}$/i.test(partnerId)) {
    errors.partnerId = "A valid partner is required.";
  }

  const amountRaw = String(raw.amount ?? "").trim();
  const currency = String(raw.currency ?? "").trim() as Currency;
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    errors.currency = "Currency must be AFN or USD.";
  }

  const amountMinor = toMinorUnits(amountRaw, isCurrencyValue(currency) ? currency : "AFN");
  if (amountMinor === null) {
    errors.amount = "Enter a valid positive amount.";
  } else if (amountMinor <= 0) {
    errors.amount = "Amount must be greater than zero.";
  }

  const investedAtRaw = String(raw.investedAt ?? "").trim();
  let investedAt: Date | null = null;
  if (investedAtRaw === "") {
    errors.investedAt = "Date is required.";
  } else {
    const parsed = new Date(investedAtRaw.length === 10 ? `${investedAtRaw}T00:00:00` : investedAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      errors.investedAt = "Enter a valid date.";
    } else {
      investedAt = parsed;
    }
  }

  const note = String(raw.note ?? "").trim();
  if (note.length > 2000) {
    errors.note = "Note must be at most 2000 characters.";
  }

  if (Object.keys(errors).length > 0 || !investedAt || amountMinor === null) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      partnerId,
      amount: amountRaw,
      currency,
      investedAt,
      note,
    },
  };
}

// ---------------------------------------------------------------------------
// Buyers & ledger (Module 2)
// ---------------------------------------------------------------------------

export interface BuyerInput {
  name: string;
  shopName: string;
  phone: string;
  address: string;
  notes: string;
  status: (typeof BUYER_STATUSES)[number];
}

export function validateBuyerInput(raw: Record<string, unknown>): ValidationResult<BuyerInput> {
  const errors: Record<string, string> = {};

  const name = String(raw.name ?? "").trim();
  if (name.length < 2 || name.length > 120) {
    errors.name = "Buyer name must be 2–120 characters.";
  }

  const shopName = String(raw.shopName ?? "").trim();
  if (shopName.length > 120) {
    errors.shopName = "Shop name must be at most 120 characters.";
  }

  const phone = String(raw.phone ?? "").trim();
  if (phone && phone.length < 7) {
    errors.phone = "Phone must be at least 7 characters, or left blank.";
  }

  const address = String(raw.address ?? "").trim();
  if (address.length > 500) {
    errors.address = "Address must be at most 500 characters.";
  }

  const notes = String(raw.notes ?? "").trim();
  if (notes.length > 2000) {
    errors.notes = "Notes must be at most 2000 characters.";
  }

  const status = String(raw.status ?? "active").trim();
  if (!(BUYER_STATUSES as readonly string[]).includes(status)) {
    errors.status = "Status must be active or inactive.";
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { name, shopName, phone, address, notes, status: status as BuyerInput["status"] },
  };
}

export interface LedgerEntryInput {
  buyerId: string;
  type: (typeof LEDGER_ENTRY_TYPES)[number];
  amount: string;
  currency: Currency;
  occurredAt: Date;
  note: string;
}

export function validateLedgerEntryInput(raw: Record<string, unknown>): ValidationResult<LedgerEntryInput> {
  const errors: Record<string, string> = {};

  const buyerId = String(raw.buyerId ?? "").trim();
  if (!/^[a-f\d]{24}$/i.test(buyerId)) {
    errors.buyerId = "A valid buyer is required.";
  }

  const type = String(raw.type ?? "").trim();
  if (!(LEDGER_ENTRY_TYPES as readonly string[]).includes(type)) {
    errors.type = "Entry type must be goods or payment.";
  }

  const amountRaw = String(raw.amount ?? "").trim();
  const currency = String(raw.currency ?? "").trim() as Currency;
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    errors.currency = "Currency must be AFN or USD.";
  }

  const amountMinor = toMinorUnits(amountRaw, isCurrencyValue(currency) ? currency : "AFN");
  if (amountMinor === null) {
    errors.amount = "Enter a valid positive amount.";
  } else if (amountMinor <= 0) {
    errors.amount = "Amount must be greater than zero.";
  }

  const occurredAtRaw = String(raw.occurredAt ?? "").trim();
  let occurredAt: Date | null = null;
  if (occurredAtRaw === "") {
    errors.occurredAt = "Date is required.";
  } else {
    const parsed = new Date(occurredAtRaw.length === 10 ? `${occurredAtRaw}T00:00:00` : occurredAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      errors.occurredAt = "Enter a valid date.";
    } else {
      occurredAt = parsed;
    }
  }

  const note = String(raw.note ?? "").trim();
  if (note.length > 2000) {
    errors.note = "Note must be at most 2000 characters.";
  }

  if (Object.keys(errors).length > 0 || !occurredAt || amountMinor === null) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      buyerId,
      type: type as LedgerEntryInput["type"],
      amount: amountRaw,
      currency,
      occurredAt,
      note,
    },
  };
}

// ---------------------------------------------------------------------------
// Payment reminders (informational only)
// ---------------------------------------------------------------------------

const WEEKDAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export interface PaymentReminderInput {
  buyerId: string;
  schedule: (typeof REMINDER_SCHEDULES)[number];
  weekday: number | null;
  dueDate: Date | null;
  amountMinor: number;
  currency: Currency;
  note: string;
  active: boolean;
}

export function validatePaymentReminderInput(raw: Record<string, unknown>): ValidationResult<PaymentReminderInput> {
  const errors: Record<string, string> = {};

  const buyerId = String(raw.buyerId ?? "").trim();
  if (!/^[a-f\d]{24}$/i.test(buyerId)) {
    errors.buyerId = "A valid buyer is required.";
  }

  const schedule = String(raw.schedule ?? "").trim();
  if (!(REMINDER_SCHEDULES as readonly string[]).includes(schedule)) {
    errors.schedule = "Schedule must be weekly or a single date.";
  }

  let weekday: number | null = null;
  let dueDate: Date | null = null;

  if (schedule === "weekly") {
    const weekdayRaw = String(raw.weekday ?? "").trim();
    const index = weekdayRaw === "" ? -1 : Number(weekdayRaw);
    if (!Number.isInteger(index) || index < 0 || index > 6) {
      errors.weekday = "Pick a day of the week.";
    } else {
      weekday = index;
    }
  } else if (schedule === "date") {
    const dueDateRaw = String(raw.dueDate ?? "").trim();
    if (dueDateRaw === "") {
      errors.dueDate = "A due date is required for one-time reminders.";
    } else {
      const parsed = new Date(dueDateRaw.length === 10 ? `${dueDateRaw}T00:00:00` : dueDateRaw);
      if (Number.isNaN(parsed.getTime())) {
        errors.dueDate = "Enter a valid date.";
      } else {
        dueDate = parsed;
      }
    }
  }

  const amountRaw = String(raw.amount ?? "").trim();
  const currency = String(raw.currency ?? "").trim() as Currency;
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    errors.currency = "Currency must be AFN or USD.";
  }

  const amountMinor = toMinorUnits(amountRaw, isCurrencyValue(currency) ? currency : "AFN");
  if (amountMinor === null) {
    errors.amount = "Enter a valid positive amount.";
  } else if (amountMinor <= 0) {
    errors.amount = "Amount must be greater than zero.";
  }

  const note = String(raw.note ?? "").trim();
  if (note.length > 2000) {
    errors.note = "Note must be at most 2000 characters.";
  }

  const activeRaw = String(raw.active ?? "on").trim();
  const active = !(activeRaw === "" || activeRaw === "off" || activeRaw === "false" || activeRaw === "0");

  if (Object.keys(errors).length > 0 || amountMinor === null) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      buyerId,
      schedule: schedule as PaymentReminderInput["schedule"],
      weekday,
      dueDate,
      amountMinor,
      currency,
      note,
      active,
    },
  };
}

export function weekdayName(index: number): string {
  return WEEKDAY_NAMES[index] ?? "";
}

// ---------------------------------------------------------------------------
// Teller / cash on hand (Module 5) — manual, with audit trail
// ---------------------------------------------------------------------------

export interface TellerTransactionInput {
  type: (typeof TELLER_TRANSACTION_TYPES)[number];
  amount: string;
  currency: Currency;
  occurredAt: Date;
  note: string;
}

export function validateTellerTransactionInput(
  raw: Record<string, unknown>,
): ValidationResult<TellerTransactionInput> {
  const errors: Record<string, string> = {};

  const type = String(raw.type ?? "").trim();
  if (!(TELLER_TRANSACTION_TYPES as readonly string[]).includes(type)) {
    errors.type = "Type must be add or remove.";
  }

  const amountRaw = String(raw.amount ?? "").trim();
  const currency = String(raw.currency ?? "").trim() as Currency;
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    errors.currency = "Currency must be AFN or USD.";
  }

  const amountMinor = toMinorUnits(amountRaw, isCurrencyValue(currency) ? currency : "AFN");
  if (amountMinor === null) {
    errors.amount = "Enter a valid positive amount.";
  } else if (amountMinor <= 0) {
    errors.amount = "Amount must be greater than zero.";
  }

  const occurredAtRaw = String(raw.occurredAt ?? "").trim();
  let occurredAt: Date | null = null;
  if (occurredAtRaw === "") {
    errors.occurredAt = "Date is required.";
  } else {
    const parsed = new Date(occurredAtRaw.length === 10 ? `${occurredAtRaw}T00:00:00` : occurredAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      errors.occurredAt = "Enter a valid date.";
    } else {
      occurredAt = parsed;
    }
  }

  const note = String(raw.note ?? "").trim();
  if (note.length > 2000) {
    errors.note = "Note must be at most 2000 characters.";
  }

  if (Object.keys(errors).length > 0 || !occurredAt || amountMinor === null) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      type: type as TellerTransactionInput["type"],
      amount: amountRaw,
      currency,
      occurredAt,
      note,
    },
  };
}

// ---------------------------------------------------------------------------
// Suppliers & their ledger (Module 3)
// ---------------------------------------------------------------------------

export interface SupplierInput {
  name: string;
  companyName: string;
  phone: string;
  address: string;
  notes: string;
  status: (typeof SUPPLIER_STATUSES)[number];
}

export function validateSupplierInput(raw: Record<string, unknown>): ValidationResult<SupplierInput> {
  const errors: Record<string, string> = {};

  const name = String(raw.name ?? "").trim();
  if (name.length < 2 || name.length > 120) {
    errors.name = "Supplier name must be 2–120 characters.";
  }

  const companyName = String(raw.companyName ?? "").trim();
  if (companyName.length > 120) {
    errors.companyName = "Company name must be at most 120 characters.";
  }

  const phone = String(raw.phone ?? "").trim();
  if (phone && phone.length < 7) {
    errors.phone = "Phone must be at least 7 characters, or left blank.";
  }

  const address = String(raw.address ?? "").trim();
  if (address.length > 500) {
    errors.address = "Address must be at most 500 characters.";
  }

  const notes = String(raw.notes ?? "").trim();
  if (notes.length > 2000) {
    errors.notes = "Notes must be at most 2000 characters.";
  }

  const status = String(raw.status ?? "active").trim();
  if (!(SUPPLIER_STATUSES as readonly string[]).includes(status)) {
    errors.status = "Status must be active or inactive.";
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name,
      companyName,
      phone,
      address,
      notes,
      status: status as SupplierInput["status"],
    },
  };
}

export interface SupplierLedgerEntryInput {
  supplierId: string;
  type: (typeof SUPPLIER_LEDGER_ENTRY_TYPES)[number];
  amount: string;
  currency: Currency;
  occurredAt: Date;
  note: string;
}

export function validateSupplierLedgerEntryInput(
  raw: Record<string, unknown>,
): ValidationResult<SupplierLedgerEntryInput> {
  const errors: Record<string, string> = {};

  const supplierId = String(raw.supplierId ?? "").trim();
  if (!/^[a-f\d]{24}$/i.test(supplierId)) {
    errors.supplierId = "A valid supplier is required.";
  }

  const type = String(raw.type ?? "").trim();
  if (!(SUPPLIER_LEDGER_ENTRY_TYPES as readonly string[]).includes(type)) {
    errors.type = "Entry type must be purchase or payment.";
  }

  const amountRaw = String(raw.amount ?? "").trim();
  const currency = String(raw.currency ?? "").trim() as Currency;
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    errors.currency = "Currency must be AFN or USD.";
  }

  const amountMinor = toMinorUnits(amountRaw, isCurrencyValue(currency) ? currency : "AFN");
  if (amountMinor === null) {
    errors.amount = "Enter a valid positive amount.";
  } else if (amountMinor <= 0) {
    errors.amount = "Amount must be greater than zero.";
  }

  const occurredAtRaw = String(raw.occurredAt ?? "").trim();
  let occurredAt: Date | null = null;
  if (occurredAtRaw === "") {
    errors.occurredAt = "Date is required.";
  } else {
    const parsed = new Date(occurredAtRaw.length === 10 ? `${occurredAtRaw}T00:00:00` : occurredAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      errors.occurredAt = "Enter a valid date.";
    } else {
      occurredAt = parsed;
    }
  }

  const note = String(raw.note ?? "").trim();
  if (note.length > 2000) {
    errors.note = "Note must be at most 2000 characters.";
  }

  if (Object.keys(errors).length > 0 || !occurredAt || amountMinor === null) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      supplierId,
      type: type as SupplierLedgerEntryInput["type"],
      amount: amountRaw,
      currency,
      occurredAt,
      note,
    },
  };
}

// ---------------------------------------------------------------------------
// Clothing inventory (Module 4)
// ---------------------------------------------------------------------------

export interface ClothInput {
  name: string;
  category: string;
  description: string;
  pricePerMeter: string;
  currency: Currency;
  supplierId: string | null;
  lowStockThresholdMeters: string;
  notes: string;
}

export function validateClothInput(raw: Record<string, unknown>): ValidationResult<ClothInput> {
  const errors: Record<string, string> = {};

  const name = String(raw.name ?? "").trim();
  if (name.length < 2 || name.length > 120) {
    errors.name = "Cloth name must be 2–120 characters.";
  }

  const category = String(raw.category ?? "").trim();
  if (category.length > 120) {
    errors.category = "Category must be at most 120 characters.";
  }

  const description = String(raw.description ?? "").trim();
  if (description.length > 2000) {
    errors.description = "Description must be at most 2000 characters.";
  }

  const pricePerMeterRaw = String(raw.pricePerMeter ?? "").trim();
  const currency = String(raw.currency ?? "").trim() as Currency;
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    errors.currency = "Currency must be AFN or USD.";
  }

  const pricePerMeterMinor = toMinorUnits(pricePerMeterRaw, isCurrencyValue(currency) ? currency : "AFN");
  if (pricePerMeterMinor === null) {
    errors.pricePerMeter = "Enter a valid price per meter.";
  } else if (pricePerMeterMinor <= 0) {
    errors.pricePerMeter = "Price per meter must be greater than zero.";
  }

  const supplierIdRaw = String(raw.supplierId ?? "").trim();
  const supplierId = /^[a-f\d]{24}$/i.test(supplierIdRaw) ? supplierIdRaw : null;

  // Optional low-stock warning threshold in meters (blank = no warning).
  const lowStockRaw = String(raw.lowStockThresholdMeters ?? "").trim();
  const lowStockThresholdMm = lowStockRaw === "" ? null : toMillimeters(lowStockRaw);
  if (lowStockThresholdMm !== null && (lowStockThresholdMm < 0 || !/^-?\d+(\.\d{1,3})?$/.test(lowStockRaw.replace(/,/g, "")))) {
    errors.lowStockThresholdMeters = "Enter a valid meter value or leave it blank.";
  }

  const notes = String(raw.notes ?? "").trim();
  if (notes.length > 2000) {
    errors.notes = "Notes must be at most 2000 characters.";
  }

  if (Object.keys(errors).length > 0 || pricePerMeterMinor === null) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      name,
      category,
      description,
      pricePerMeter: pricePerMeterRaw,
      currency,
      supplierId,
      lowStockThresholdMeters: lowStockRaw,
      notes,
    },
  };
}

/**
 * A stock movement that arrives bundled with the money side of the same
 * transaction: a purchase (supplier receives clothing) or a sale (clothing
 * given to a buyer). Also used for pure quantity adjustments.
 */
export interface InventoryTransactionInput {
  clothId: string;
  direction: "in" | "out";
  sourceType: (typeof INVENTORY_SOURCE_TYPES)[number];
  quantityMeters: string;
  pricePerMeter: string;
  currency: Currency;
  supplierId: string | null;
  buyerId: string | null;
  occurredAt: Date;
  note: string;
  /** Money side — omitted for adjustments. */
  credit: boolean;
  amountPaid: string;
}

export function validateInventoryTransactionInput(
  raw: Record<string, unknown>,
): ValidationResult<InventoryTransactionInput> {
  const errors: Record<string, string> = {};

  const clothId = String(raw.clothId ?? "").trim();
  if (!/^[a-f\d]{24}$/i.test(clothId)) {
    errors.clothId = "A valid cloth is required.";
  }

  const directionRaw = String(raw.direction ?? "").trim().toLowerCase();
  const direction = directionRaw === "in" ? "in" : directionRaw === "out" ? "out" : null;
  if (!direction) {
    errors.direction = "Direction must be IN or OUT.";
  }

  const sourceType = String(raw.sourceType ?? "").trim();
  if (!(INVENTORY_SOURCE_TYPES as readonly string[]).includes(sourceType)) {
    errors.sourceType = "Source must be purchase, sale or adjustment.";
  }

  const quantityMetersRaw = String(raw.quantityMeters ?? "").trim();
  const quantityMm = toMillimeters(quantityMetersRaw);
  if (quantityMm === null) {
    errors.quantityMeters = "Enter a valid quantity in meters.";
  } else if (quantityMm <= 0) {
    errors.quantityMeters = "Quantity must be greater than zero.";
  }

  const pricePerMeterRaw = String(raw.pricePerMeter ?? "").trim();
  const currency = String(raw.currency ?? "").trim() as Currency;
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    errors.currency = "Currency must be AFN or USD.";
  }

  const pricePerMeterMinor = toMinorUnits(pricePerMeterRaw, isCurrencyValue(currency) ? currency : "AFN");
  if (pricePerMeterMinor === null) {
    errors.pricePerMeter = "Enter a valid price per meter.";
  } else if (pricePerMeterMinor <= 0) {
    errors.pricePerMeter = "Price per meter must be greater than zero.";
  }

  const supplierIdRaw = String(raw.supplierId ?? "").trim();
  const buyerIdRaw = String(raw.buyerId ?? "").trim();
  const supplierId = /^[a-f\d]{24}$/i.test(supplierIdRaw) ? supplierIdRaw : null;
  const buyerId = /^[a-f\d]{24}$/i.test(buyerIdRaw) ? buyerIdRaw : null;

  if (sourceType === "purchase" && !supplierId) {
    errors.supplierId = "A supplier is required for purchases.";
  }
  if (sourceType === "sale" && !buyerId) {
    errors.buyerId = "A buyer is required for sales.";
  }

  const occurredAtRaw = String(raw.occurredAt ?? "").trim();
  let occurredAt: Date | null = null;
  if (occurredAtRaw === "") {
    errors.occurredAt = "Date is required.";
  } else {
    const parsed = new Date(occurredAtRaw.length === 10 ? `${occurredAtRaw}T00:00:00` : occurredAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      errors.occurredAt = "Enter a valid date.";
    } else {
      occurredAt = parsed;
    }
  }

  const note = String(raw.note ?? "").trim();
  if (note.length > 2000) {
    errors.note = "Note must be at most 2000 characters.";
  }

  const creditRaw = String(raw.credit ?? "off").trim().toLowerCase();
  const credit = creditRaw === "on" || creditRaw === "true" || creditRaw === "1";

  const amountPaidRaw = String(raw.amountPaid ?? "0").trim();
  const amountPaidMinor =
    amountPaidRaw === "" ? 0 : toMinorUnits(amountPaidRaw, isCurrencyValue(currency) ? currency : "AFN");
  if (amountPaidMinor === null) {
    errors.amountPaid = "Enter a valid paid amount, or leave it empty.";
  }

  if (
    Object.keys(errors).length > 0 ||
    !direction ||
    quantityMm === null ||
    quantityMm <= 0 ||
    pricePerMeterMinor === null ||
    amountPaidMinor === null ||
    !occurredAt
  ) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      clothId,
      direction,
      sourceType: sourceType as InventoryTransactionInput["sourceType"],
      quantityMeters: quantityMetersRaw,
      pricePerMeter: pricePerMeterRaw,
      currency,
      supplierId,
      buyerId,
      occurredAt,
      note,
      credit,
      amountPaid: amountPaidRaw,
    },
  };
}
