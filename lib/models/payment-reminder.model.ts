import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { CURRENCIES, REMINDER_SCHEDULES } from "../constants";

const paymentReminderSchema = new Schema(
  {
    /** Tenant reference — denormalized from the buyer for tenant-safe queries. */
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    buyerId: {
      type: Schema.Types.ObjectId,
      ref: "Buyer",
      required: true,
      index: true,
    },
    /** `weekly` = every given weekday (e.g. every Thursday); `date` = one-off. */
    schedule: { type: String, enum: REMINDER_SCHEDULES, required: true },
    /** 0 (Sunday) – 6 (Saturday); required when schedule === "weekly". */
    weekday: { type: Number, min: 0, max: 6, default: null },
    /** Required when schedule === "date". */
    dueDate: { type: Date, default: null },
    /** Integer minor units (see lib/money.ts). */
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: CURRENCIES, required: true },
    note: { type: String, trim: true, maxlength: 2000, default: "" },
    active: { type: Boolean, required: true, default: true },
  },
  {
    timestamps: true,
    collection: "payment_reminders",
  },
);

paymentReminderSchema.index({ tenantId: 1, buyerId: 1, active: 1 });
paymentReminderSchema.index({ tenantId: 1, active: 1 });

export type PaymentReminder = InferSchemaType<typeof paymentReminderSchema>;

export type PaymentReminderDocument = mongoose.HydratedDocument<PaymentReminder>;

export const PaymentReminderModel: Model<PaymentReminder> =
  (mongoose.models.PaymentReminder as Model<PaymentReminder>) ||
  mongoose.model<PaymentReminder>("PaymentReminder", paymentReminderSchema);
