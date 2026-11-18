/** Serializable data needed to render a printable ledger receipt. */
export interface PrintPayload {
  kind: "buyer" | "supplier";
  shopName: string;
  partyName: string;
  partyCode: string;
  type: string;
  amountMinor: number;
  currency: "AFN" | "USD";
  /** ISO date string (client formats it with the active locale). */
  date: string;
  billNo: string;
  receivedBy: string;
  note: string;
}
