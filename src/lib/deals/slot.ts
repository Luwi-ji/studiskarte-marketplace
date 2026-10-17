/**
 * Where a reservation's payment stands, and whether its slot is secured.
 * Pure: shared by the server, the thread and the Transactions list.
 *
 * Order of events once a time and place are agreed:
 * - Online or others: the one being paid asks the other to pay ("asked"), the
 *   payer says they paid ("paid"), the payee confirms receiving it ("confirmed").
 * - Cash: the payer asks to pay cash in person ("cash_requested") and the payee
 *   agrees ("cash_agreed"); the cash changes hands at the handover.
 * The slot is secured from "paid" or "cash_agreed" on: nobody can cancel then.
 */
export type PaymentStage = "free" | "open" | "asked" | "cash_requested" | "paid" | "confirmed" | "cash_agreed";

export type PaymentFields = {
  amount: number;
  paymentAskedAt: Date | null;
  cashRequestedAt: Date | null;
  cashAgreedAt: Date | null;
  paidAt: Date | null;
  paymentConfirmedAt: Date | null;
};

export function paymentStage(d: PaymentFields): PaymentStage {
  if (d.amount === 0) return "free";
  if (d.paymentConfirmedAt) return "confirmed";
  if (d.paidAt) return "paid";
  if (d.cashAgreedAt) return "cash_agreed";
  if (d.cashRequestedAt) return "cash_requested";
  if (d.paymentAskedAt) return "asked";
  return "open";
}

/** The slot is secured: the payer said they paid, or cash in person was agreed. A secured reservation cannot be cancelled. */
export function isSecured(d: PaymentFields): boolean {
  const stage = paymentStage(d);
  return stage === "paid" || stage === "confirmed" || stage === "cash_agreed";
}

/**
 * Ready to complete: both confirmed the handover, and the payment is settled
 * (confirmed by the payee, or cash in person agreed, or there was nothing to pay).
 */
export function readyToComplete(d: PaymentFields & { ownerConfirmedAt: Date | null; responderConfirmedAt: Date | null }): boolean {
  const stage = paymentStage(d);
  return d.ownerConfirmedAt !== null && d.responderConfirmedAt !== null && (stage === "free" || stage === "confirmed" || stage === "cash_agreed");
}

export const SECURED_NO_CANCEL = "The slot is secured (paid, or cash in person agreed), so it can't be cancelled. If something went wrong, report what happened.";

/**
 * Whether a problem can be reported now: on a reservation being carried out
 * whose slot is secured (it cannot be cancelled, so a report is the way out),
 * or whose time has come and passed without it being completed.
 */
export function canReport(d: PaymentFields & { status: string; scheduledAt: Date | null }, now = new Date()): boolean {
  if (d.status !== "agreed" && d.status !== "scheduled") return false;
  return isSecured(d) || (d.status === "scheduled" && d.scheduledAt !== null && d.scheduledAt.getTime() <= now.getTime());
}

export type ReportReason = "no_show" | "not_as_described" | "payment_problem" | "unresponsive" | "other";

export const REPORT_REASONS: Record<ReportReason, string> = {
  no_show: "Did not show up or deliver",
  not_as_described: "Not as described",
  payment_problem: "A problem with the payment",
  unresponsive: "Stopped replying",
  other: "Something else",
};

export const DETAILS_MAX = 500;
