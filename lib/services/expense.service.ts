import "server-only";

import mongoose from "mongoose";
import { EmployeeModel, ExpenseModel, type ExpenseDocument } from "../models";
import { connectToDatabase } from "../mongodb";
import { fromMinorUnits, toMinorUnits } from "../money";
import type { ExpenseInput } from "../validation";

export class ExpenseServiceError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "ExpenseServiceError";
    this.field = field;
  }
}

function assertTenantId(tenantId: string): void {
  if (!/^[a-f\d]{24}$/i.test(tenantId)) {
    throw new ExpenseServiceError("Invalid tenant.");
  }
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

export async function listExpenses(tenantId: string): Promise<ExpenseDocument[]> {
  assertTenantId(tenantId);
  await connectToDatabase();
  return ExpenseModel.find({ tenantId: toObjectId(tenantId) }).sort({ occurredAt: -1, createdAt: -1 });
}

export async function getExpenseById(
  tenantId: string,
  expenseId: string,
): Promise<ExpenseDocument | null> {
  assertTenantId(tenantId);
  if (!/^[a-f\d]{24}$/i.test(expenseId)) return null;
  await connectToDatabase();
  return ExpenseModel.findOne({ _id: toObjectId(expenseId), tenantId: toObjectId(tenantId) });
}

async function toDocData(tenantId: string, input: ExpenseInput) {
  const amountMinor = toMinorUnits(input.amount, input.currency);
  if (amountMinor === null || amountMinor <= 0) {
    throw new ExpenseServiceError("Invalid expense amount.", "amount");
  }

  // Salary expenses are always linked to a tenant employee; the employee name
  // is used as the description when the merchant left it blank.
  let employeeId: mongoose.Types.ObjectId | null = null;
  let name = input.name;
  if (input.category === "salary") {
    if (!input.employeeId) {
      throw new ExpenseServiceError("Select an employee for salary.", "employeeId");
    }
    const employee = await EmployeeModel.findOne({
      _id: toObjectId(input.employeeId),
      tenantId: toObjectId(tenantId),
    });
    if (!employee) {
      throw new ExpenseServiceError("Employee not found.", "employeeId");
    }
    employeeId = employee._id;
    if (!name) name = employee.name;
  }

  return {
    category: input.category,
    name,
    employeeId,
    amountMinor,
    currency: input.currency,
    occurredAt: input.occurredAt,
    note: input.note,
  };
}

export async function createExpense(
  tenantId: string,
  userId: string,
  input: ExpenseInput,
): Promise<ExpenseDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();
  const data = await toDocData(tenantId, input);
  return ExpenseModel.create({
    tenantId: toObjectId(tenantId),
    ...data,
    createdBy: toObjectId(userId),
    updatedBy: toObjectId(userId),
  });
}

export async function updateExpense(
  tenantId: string,
  expenseId: string,
  userId: string,
  input: ExpenseInput,
): Promise<ExpenseDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();
  const expense = await getExpenseById(tenantId, expenseId);
  if (!expense) throw new ExpenseServiceError("Expense not found.");
  const data = await toDocData(tenantId, input);
  Object.assign(expense, data);
  expense.updatedBy = toObjectId(userId);
  await expense.save();
  return expense;
}

export async function deleteExpense(tenantId: string, expenseId: string): Promise<void> {
  assertTenantId(tenantId);
  if (!/^[a-f\d]{24}$/i.test(expenseId)) return;
  await connectToDatabase();
  await ExpenseModel.deleteOne({ _id: toObjectId(expenseId), tenantId: toObjectId(tenantId) });
}

export interface ExpenseTotals {
  AFN: number;
  USD: number;
  display: Record<"AFN" | "USD", number>;
}

export async function getExpenseTotals(tenantId: string): Promise<ExpenseTotals> {
  assertTenantId(tenantId);
  await connectToDatabase();
  const rows = await ExpenseModel.aggregate<{ _id: "AFN" | "USD"; total: number }>([
    { $match: { tenantId: toObjectId(tenantId) } },
    { $group: { _id: "$currency", total: { $sum: "$amountMinor" } } },
  ]);
  const totals = { AFN: 0, USD: 0 };
  for (const row of rows) totals[row._id] = row.total;
  return {
    ...totals,
    display: {
      AFN: fromMinorUnits(totals.AFN, "AFN"),
      USD: fromMinorUnits(totals.USD, "USD"),
    },
  };
}
