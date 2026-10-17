/**
 * Where a reservation's payment stands, and whether it can still be cancelled.
 * Pure: shared by the server, the thread and the Transactions list.
 *
 * Every step is a two-way handshake: one says, the other confirms. Order of
 * events once a time and place are agreed:
 * - Online or others: the one being paid asks the other to pay ("asked"), the
 *   payer says they paid ("paid"), the payee confirms receiving it ("confirmed").
 * - Cash: the payer asks to pay cash in person ("cash_requested") and the payee
 *   agrees ("cash_agreed"). The cash then changes hands at the handover: the
 *   payer says they gave it ("cash_given"), the payee says they received it
 *   ("cash_received").
 * Payment is settled by "confirmed", "cash_received", or "free"; nothing less.
 * The reservation can no longer be cancelled from "paid" or "cash_agreed" on, or
 * once either person said the handover happened.
 */
export type PaymentStage = "free" | "open" | "asked" | "cash_requested" | "paid" | "confirmed" | "cash_agreed" | "cash_given" | "cash_received";

export type PaymentFields = {
  amount: number;
  paymentAskedAt: Date | null;
  cashRequestedAt: Date | null;
  cashAgreedAt: Date | null;
  cashGivenAt: Date | null;
  cashReceivedAt: Date | null;
  paidAt: Date | null;
  paymentConfirmedAt: Date | null;
};

export type HandoverConfirmations = { ownerConfirmedAt: Date | null; responderConfirmedAt: Date | null };

export function paymentStage(d: PaymentFields): PaymentStage {
  if (d.amount === 0) return "free";
  if (d.paymentConfirmedAt) return "confirmed";
  if (d.paidAt) return "paid";
  if (d.cashReceivedAt) return "cash_received";
  if (d.cashGivenAt) return "cash_given";
  if (d.cashAgreedAt) return "cash_agreed";
  if (d.cashRequestedAt) return "cash_requested";
  if (d.paymentAskedAt) return "asked";
  return "open";
}

/** Cash in person was agreed (and perhaps already given or received). */
export function isCashStage(stage: PaymentStage): boolean {
  return stage === "cash_agreed" || stage === "cash_given" || stage === "cash_received";
}

/** The payment is settled: confirmed by the payee, cash received, or nothing to pay. */
export function isSettled(stage: PaymentStage): boolean {
  return stage === "free" || stage === "confirmed" || stage === "cash_received";
}

/**
 * The reservation can no longer be cancelled: the payer said they paid, cash in
 * person was agreed, or one of the two said the handover happened (the other
 * cannot wipe that out). Only completing or a report ends it then.
 */
export function isSecured(d: PaymentFields & HandoverConfirmations): boolean {
  const stage = paymentStage(d);
  return stage === "paid" || stage === "confirmed" || isCashStage(stage) || d.ownerConfirmedAt !== null || d.responderConfirmedAt !== null;
}

/**
 * Ready to complete: both confirmed the handover, and the payment is settled
 * (confirmed by the payee, or the cash received, or there was nothing to pay).
 */
export function readyToComplete(d: PaymentFields & HandoverConfirmations): boolean {
  return d.ownerConfirmedAt !== null && d.responderConfirmedAt !== null && isSettled(paymentStage(d));
}

export const SECURED_NO_CANCEL = "This can't be cancelled any more: payment is under way, cash in person is agreed, or one of you said the handover happened. If something went wrong, report what happened.";

/**
 * Whether a problem can be reported now: on a reservation being carried out
 * that cannot be cancelled (a report is the way out), or whose time has come
 * and passed without it being completed.
 */
export function canReport(d: PaymentFields & HandoverConfirmations & { status: string; scheduledAt: Date | null }, now = new Date()): boolean {
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
