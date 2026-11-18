import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { CURRENCIES, EMPLOYEE_STATUSES } from "../constants";

/**
 * Shop employees. Employee names are offered as "received by" options when
 * recording a payment received on a ledger entry.
 */
const employeeSchema = new Schema(
  {
    /** Tenant reference — every employee belongs to exactly one shop. */
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 40, default: "" },
    /** Job title / role, e.g. "Cashier", "Driver". */
    role: { type: String, trim: true, maxlength: 120, default: "" },
    /** Monthly salary in integer minor units (0 = not set). */
    salaryAmountMinor: { type: Number, min: 0, default: 0 },
    salaryCurrency: { type: String, enum: CURRENCIES, default: "AFN" },
    notes: { type: String, trim: true, maxlength: 2000, default: "" },
    status: {
      type: String,
      enum: EMPLOYEE_STATUSES,
      required: true,
      default: "active",
      index: true,
    },
    /** Audit trail. */
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
    collection: "employees",
  },
);

employeeSchema.index({ tenantId: 1, name: 1 });
employeeSchema.index({ tenantId: 1, createdAt: -1 });

export type Employee = InferSchemaType<typeof employeeSchema>;

export type EmployeeDocument = mongoose.HydratedDocument<Employee>;

/**
 * Next.js hot reload can keep an already-compiled model whose schema does not
 * include newly added fields (e.g. salary), silently dropping them on save.
 * In development, clear the cached model so this schema is registered fresh.
 */
if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.Employee;
}

export const EmployeeModel: Model<Employee> =
  (mongoose.models.Employee as Model<Employee>) ||
  mongoose.model<Employee>("Employee", employeeSchema);
