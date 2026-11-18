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

/**
 * Cloth measurement units. YARD is the default for buying and selling; METER
 * is also supported. Quantities are stored canonically in integer millimeters
 * (see lib/measure.ts).
 */
export const CLOTH_UNITS = ["yard", "meter"] as const;
export type ClothUnit = (typeof CLOTH_UNITS)[number];
export const CLOTH_UNIT = {
  YARD: "yard",
  METER: "meter",
} as const;
export const DEFAULT_CLOTH_UNIT: ClothUnit = "yard";

/**
 * Standard expense categories for the Expenses module. These labels are also
 * offered as "received by" options on payment ledger entries.
 */
export const EXPENSE_CATEGORIES = [
  "shopRent",
  "warehouseRent",
  "yearlyTaxes",
  "kitchenDaily",
  "dailyOther",
  "clothTransfer",
  "electricity",
  "salary",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_CATEGORY = {
  SHOP_RENT: "shopRent",
  WAREHOUSE_RENT: "warehouseRent",
  YEARLY_TAXES: "yearlyTaxes",
  KITCHEN_DAILY: "kitchenDaily",
  DAILY_OTHER: "dailyOther",
  CLOTH_TRANSFER: "clothTransfer",
  ELECTRICITY: "electricity",
  SALARY: "salary",
  OTHER: "other",
} as const;

/** Statuses for expense/employee records. */
export const EMPLOYEE_STATUSES = ["active", "inactive"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];
export const EMPLOYEE_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
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

/**
 * Shop-level permissions. Roles bundle these; the owner role always has all.
 * Every mutating server action checks the permission for its module.
 */
export const PERMISSIONS = [
  "dashboard.view",
  "partners.manage",
  "buyers.manage",
  "suppliers.manage",
  "inventory.manage",
  "teller.manage",
  "expenses.manage",
  "employees.manage",
  "bills.view",
  "reports.view",
  "reminders.manage",
  "ledger.edit",
  "ledger.delete",
  "users.manage",
  "roles.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Translation key for each permission (used by the roles screen). */
export const PERMISSION_LABEL_KEYS: Record<Permission, string> = {
  "dashboard.view": "permissions.dashboardView",
  "partners.manage": "permissions.partnersManage",
  "buyers.manage": "permissions.buyersManage",
  "suppliers.manage": "permissions.suppliersManage",
  "inventory.manage": "permissions.inventoryManage",
  "teller.manage": "permissions.tellerManage",
  "expenses.manage": "permissions.expensesManage",
  "employees.manage": "permissions.employeesManage",
  "bills.view": "permissions.billsView",
  "reports.view": "permissions.reportsView",
  "reminders.manage": "permissions.remindersManage",
  "ledger.edit": "permissions.ledgerEdit",
  "ledger.delete": "permissions.ledgerDelete",
  "users.manage": "permissions.usersManage",
  "roles.manage": "permissions.rolesManage",
};

/** Built-in roles seeded for every shop. Keys are stable; names are editable. */
export const DEFAULT_SHOP_ROLES: ReadonlyArray<{
  key: string;
  name: string;
  permissions: Permission[];
}> = [
  {
    key: "owner",
    name: "Owner",
    permissions: [...PERMISSIONS],
  },
  {
    key: "manager",
    name: "Manager",
    permissions: PERMISSIONS.filter(
      (permission) => permission !== "users.manage" && permission !== "roles.manage",
    ),
  },
  {
    key: "accountant",
    name: "Accountant",
    permissions: [
      "dashboard.view",
      "buyers.manage",
      "suppliers.manage",
      "expenses.manage",
      "reports.view",
      "bills.view",
      "ledger.edit",
    ],
  },
  {
    key: "cashier",
    name: "Cashier",
    permissions: ["dashboard.view", "buyers.manage", "teller.manage", "bills.view"],
  },
  {
    key: "viewer",
    name: "Viewer",
    permissions: ["dashboard.view", "reports.view", "bills.view"],
  },
];

/** System role keys that cannot be deleted. */
export const SYSTEM_ROLE_KEYS = ["owner"] as const;

/** Ledger entry audit actions (reason is mandatory for both). */
export const LEDGER_AUDIT_ACTIONS = ["update", "delete"] as const;
export type LedgerAuditAction = (typeof LEDGER_AUDIT_ACTIONS)[number];

export const LEDGER_AUDIT_LEDGERS = ["buyer", "supplier"] as const;
export type LedgerAuditLedger = (typeof LEDGER_AUDIT_LEDGERS)[number];
