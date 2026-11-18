import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { CURRENCIES, EXPENSE_CATEGORIES } from "../constants";

/**
 * Shop expenses (rent, warehouse, taxes, kitchen, transfers, electricity…).
 * Amounts follow the same integer-minor-unit rule as every other money field
 * and are always kept per currency (AFN / USD are never combined).
 */
const expenseSchema = new Schema(
  {
    /** Tenant reference — every expense belongs to exactly one shop. */
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      required: true,
      index: true,
    },
    /** Optional custom label, e.g. "Generator diesel". */
    name: { type: String, trim: true, maxlength: 120, default: "" },
    /** Employee paid, for salary expenses. */
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
      index: true,
    },
    /** Integer minor units (see lib/money.ts) — never a float. */
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: CURRENCIES, required: true },
    /** Business date chosen by the merchant. */
    occurredAt: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 2000, default: "" },
    /** Audit trail. */
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    collection: "expenses",
  },
);

expenseSchema.index({ tenantId: 1, occurredAt: -1 });
expenseSchema.index({ tenantId: 1, category: 1 });

export type Expense = InferSchemaType<typeof expenseSchema>;

export type ExpenseDocument = mongoose.HydratedDocument<Expense>;

/**
 * Same dev-only refresh as Employee: ensures newly added fields (employeeId)
 * are not stripped by a stale model kept alive across hot reloads.
 */
if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.Expense;
}

export const ExpenseModel: Model<Expense> =
  (mongoose.models.Expense as Model<Expense>) ||
  mongoose.model<Expense>("Expense", expenseSchema);
