import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { LEDGER_AUDIT_ACTIONS, LEDGER_AUDIT_LEDGERS } from "../constants";

/**
 * Immutable audit record for every buyer/supplier ledger entry update or
 * deletion. A reason is mandatory, and the full before/after state is kept
 * so financial history stays explainable.
 */
const ledgerEntryAuditSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    ledger: { type: String, enum: LEDGER_AUDIT_LEDGERS, required: true },
    /** Id of the entry that was changed or removed. */
    entryId: { type: Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, enum: LEDGER_AUDIT_ACTIONS, required: true },
    /** Mandatory human explanation for the change. */
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    /** Full entry snapshot before the change (and after, for updates). */
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: true,
    collection: "ledger_entry_audits",
  },
);

ledgerEntryAuditSchema.index({ tenantId: 1, entryId: 1, createdAt: -1 });
ledgerEntryAuditSchema.index({ tenantId: 1, createdAt: -1 });

export type LedgerEntryAudit = InferSchemaType<typeof ledgerEntryAuditSchema>;

export type LedgerEntryAuditDocument = mongoose.HydratedDocument<LedgerEntryAudit>;

if (process.env.NODE_ENV !== "production") {
  delete mongoose.models.LedgerEntryAudit;
}

export const LedgerEntryAuditModel: Model<LedgerEntryAudit> =
  (mongoose.models.LedgerEntryAudit as Model<LedgerEntryAudit>) ||
  mongoose.model<LedgerEntryAudit>("LedgerEntryAudit", ledgerEntryAuditSchema);
