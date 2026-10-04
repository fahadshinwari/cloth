export const CURRENCIES = ["AFN", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = "AFN";

export const SHOP_STATUSES = ["active", "inactive"] as const;
export type ShopStatus = (typeof SHOP_STATUSES)[number];

export const SHOP_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export const USER_ROLES = ["super_admin", "merchant_admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE = {
  SUPER_ADMIN: "super_admin",
  MERCHANT_ADMIN: "merchant_admin",
} as const;

export const SESSION_COOKIE = "ws_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/** Statuses for business partners (Module: Partners & Investments). */
export const PARTNER_STATUSES = ["active", "inactive"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
export const PARTNER_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

/** Statuses for wholesale buyers/shopkeepers (Module: Buyers). */
export const BUYER_STATUSES = ["active", "inactive"] as const;
export type BuyerStatus = (typeof BUYER_STATUSES)[number];
export const BUYER_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

/**
 * Ledger entry types for a buyer.
 * `goods`   → clothes/goods given to the buyer (increases outstanding)
 * `payment` → cash/payment received from the buyer (decreases outstanding)
 * The outstanding balance is always derived from these entries — never stored.
 */
export const LEDGER_ENTRY_TYPES = ["goods", "payment"] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];
export const LEDGER_ENTRY_TYPE = {
  GOODS: "goods",
  PAYMENT: "payment",
} as const;

/**
 * Payment reminder schedules (informational only — never touch ledgers).
 * `weekly` → repeats on a given day of week (e.g. "every Thursday")
 * `date`   → one-time reminder on a specific date
 */
export const REMINDER_SCHEDULES = ["weekly", "date"] as const;
export type ReminderSchedule = (typeof REMINDER_SCHEDULES)[number];
export const REMINDER_SCHEDULE = {
  WEEKLY: "weekly",
  DATE: "date",
} as const;

/** Statuses for suppliers/importers (Module 3). */
export const SUPPLIER_STATUSES = ["active", "inactive"] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];
export const SUPPLIER_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

/**
 * Supplier ledger entry types.
 * `purchase` → clothing taken on credit (increases the payable balance)
 * `payment`  → money paid to the supplier (decreases the payable balance)
 */
export const SUPPLIER_LEDGER_ENTRY_TYPES = ["purchase", "payment"] as const;
export type SupplierLedgerEntryType = (typeof SUPPLIER_LEDGER_ENTRY_TYPES)[number];
export const SUPPLIER_LEDGER_ENTRY_TYPE = {
  PURCHASE: "purchase",
  PAYMENT: "payment",
} as const;

/** Inventory movement directions (Module 4). */
export const INVENTORY_DIRECTIONS = ["in", "out"] as const;
export type InventoryDirection = (typeof INVENTORY_DIRECTIONS)[number];
export const INVENTORY_DIRECTION = {
  IN: "in",
  OUT: "out",
} as const;

/**
 * Teller (cash on hand) transaction types — Module 5.
 * Fully manual, with an audit trail; never auto-modified by other modules.
 */
export const TELLER_TRANSACTION_TYPES = ["add", "remove"] as const;
export type TellerTransactionType = (typeof TELLER_TRANSACTION_TYPES)[number];
export const TELLER_TRANSACTION_TYPE = {
  ADD: "add",
  REMOVE: "remove",
} as const;

/** What kind of business transaction produced an inventory movement. */
export const INVENTORY_SOURCE_TYPES = ["purchase", "sale", "adjustment"] as const;
export type InventorySourceType = (typeof INVENTORY_SOURCE_TYPES)[number];
export const INVENTORY_SOURCE_TYPE = {
  PURCHASE: "purchase",
  SALE: "sale",
  ADJUSTMENT: "adjustment",
} as const;

export const LOCALES = ["en", "fa-AF", "ps"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Reserved slugs that would collide with platform routes. */
export const RESERVED_SLUGS = [
  "admin",
  "api",
  "login",
  "logout",
  "shop",
  "public",
  "static",
  "assets",
  "_next",
] as const;

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
