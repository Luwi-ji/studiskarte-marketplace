/** The ways a listing says payment is made. */
export type PaymentMode = "cash" | "online" | "other";

export const PAYMENT_LABEL: Record<PaymentMode, string> = { cash: "Cash", online: "Online payment", other: "Others" };

/** The note on a listing (where to pay online, or what "others" means), at most this many characters. */
export const PAYMENT_NOTE_MAX = 100;

/** The modes a post takes, in display order. */
export function paymentModesOf(p: { paymentCash: boolean; paymentOnline: boolean; paymentOther: boolean }): PaymentMode[] {
  return [...(p.paymentCash ? (["cash"] as const) : []), ...(p.paymentOnline ? (["online"] as const) : []), ...(p.paymentOther ? (["other"] as const) : [])];
}
