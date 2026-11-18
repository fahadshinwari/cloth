import "server-only";

import mongoose from "mongoose";
import { EmployeeModel, type EmployeeDocument } from "../models";
import { connectToDatabase } from "../mongodb";
import { toMinorUnits } from "../money";
import type { EmployeeInput } from "../validation";

export class EmployeeServiceError extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "EmployeeServiceError";
    this.field = field;
  }
}

function assertTenantId(tenantId: string): void {
  if (!/^[a-f\d]{24}$/i.test(tenantId)) {
    throw new EmployeeServiceError("Invalid tenant.");
  }
}

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

function salaryData(input: EmployeeInput): {
  salaryAmountMinor: number;
  salaryCurrency: EmployeeInput["salaryCurrency"];
} {
  const salaryAmountMinor =
    input.salaryAmount.trim() === "" ? 0 : toMinorUnits(input.salaryAmount, input.salaryCurrency);
  if (salaryAmountMinor === null || salaryAmountMinor < 0) {
    throw new EmployeeServiceError("Invalid salary.", "salaryAmount");
  }
  return { salaryAmountMinor, salaryCurrency: input.salaryCurrency };
}

export async function listEmployees(tenantId: string): Promise<EmployeeDocument[]> {
  assertTenantId(tenantId);
  await connectToDatabase();
  return EmployeeModel.find({ tenantId: toObjectId(tenantId) }).sort({ name: 1 });
}

export async function getEmployeeById(
  tenantId: string,
  employeeId: string,
): Promise<EmployeeDocument | null> {
  assertTenantId(tenantId);
  if (!/^[a-f\d]{24}$/i.test(employeeId)) return null;
  await connectToDatabase();
  return EmployeeModel.findOne({ _id: toObjectId(employeeId), tenantId: toObjectId(tenantId) });
}

export async function createEmployee(
  tenantId: string,
  userId: string,
  input: EmployeeInput,
): Promise<EmployeeDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const duplicate = await EmployeeModel.findOne({
    tenantId: toObjectId(tenantId),
    name: input.name,
  });
  if (duplicate) {
    throw new EmployeeServiceError("An employee with this name already exists.", "name");
  }

  const salary = salaryData(input);
  return EmployeeModel.create({
    tenantId: toObjectId(tenantId),
    name: input.name,
    phone: input.phone,
    role: input.role,
    ...salary,
    notes: input.notes,
    status: input.status,
    createdBy: toObjectId(userId),
    updatedBy: toObjectId(userId),
  });
}

export async function updateEmployee(
  tenantId: string,
  employeeId: string,
  userId: string,
  input: EmployeeInput,
): Promise<EmployeeDocument> {
  assertTenantId(tenantId);
  await connectToDatabase();

  const employee = await getEmployeeById(tenantId, employeeId);
  if (!employee) throw new EmployeeServiceError("Employee not found.");

  const duplicate = await EmployeeModel.findOne({
    tenantId: toObjectId(tenantId),
    name: input.name,
    _id: { $ne: employee._id },
  });
  if (duplicate) {
    throw new EmployeeServiceError("An employee with this name already exists.", "name");
  }

  const salary = salaryData(input);
  employee.name = input.name;
  employee.phone = input.phone;
  employee.role = input.role;
  employee.salaryAmountMinor = salary.salaryAmountMinor;
  employee.salaryCurrency = salary.salaryCurrency;
  employee.notes = input.notes;
  employee.status = input.status;
  employee.updatedBy = toObjectId(userId);
  await employee.save();
  return employee;
}

export async function deleteEmployee(tenantId: string, employeeId: string): Promise<void> {
  assertTenantId(tenantId);
  if (!/^[a-f\d]{24}$/i.test(employeeId)) return;
  await connectToDatabase();
  await EmployeeModel.deleteOne({ _id: toObjectId(employeeId), tenantId: toObjectId(tenantId) });
}
