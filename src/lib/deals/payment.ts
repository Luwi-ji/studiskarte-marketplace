import { eq } from "drizzle-orm";
import { z } from "zod";
import { deal } from "@/db/schema";
import { getDb } from "@/lib/db";
import { syncAvailability } from "@/lib/deals/capacity";
import { lockDeal, touched, type LockedDeal } from "@/lib/deals/lock";
import { activeFor, tellOther, type HandoverResult } from "@/lib/deals/schedule";
import { isCashStage, paymentStage, readyToComplete } from "@/lib/deals/slot";
import type { DbTransaction } from "@/lib/db";
import type { AlertSink, DealNoticeType, Recorded } from "@/lib/notifications/record";
import { paymentModesOf, type PaymentMode } from "@/lib/payment";

export const NOT_PAYER = "Only the one paying can do that.";
export const NOT_PAYEE = "Only the one being paid can do that.";
export const NOTHING_TO_PAY = "This one is free, so there is nothing to pay.";
export const NOT_PAID_YET = "Wait until they say they have paid.";
export const NEEDS_SLOT = "Agree a time and place first.";
export const NOT_ASKED = "Wait until they ask you to pay.";
export const ALREADY_SECURED = "The slot is already secured.";
export const CASH_NOT_AGREED = "Cash in person has to be agreed first.";
export const CASH_NOT_GIVEN = "Wait until they say they gave the cash.";
const NO_MODE = "Choose how they should pay.";
const MODE_NOT_TAKEN = "This post does not take that way of paying.";
const NO_CASH = "This post does not take cash.";
const NO_CASH_REQUEST = "There is no cash request to answer.";
const CASH_WAITING = "Answer their cash request first.";

const askSchema = z.object({ method: z.enum(["online", "other"]).optional() });

/** Who pays: on a Showcase the buyer (who reserved), on a Wishlist the one who posted it. */
export function payerOf(d: { postKind: string; ownerId: string; responderId: string }): string {
  return d.postKind === "wishlist" ? d.ownerId : d.responderId;
}

/** The total for the deal: the price each times the units. */
export function dealTotal(d: { amount: number; quantity: number }): number {
  return d.amount * d.quantity;
}

type Checked = { found: LockedDeal } | { error: HandoverResult & { ok: false } };

/** The deal as the one being paid (`payee`) or paying, once a time and place are agreed and money is involved. */
function guard(found: LockedDeal | null, actorId: string, as: "payer" | "payee"): Checked {
  const checked = activeFor(found, actorId);
  if ("error" in checked) return checked;
  const d = checked.found;
  if (d.amount === 0) return { error: { ok: false, error: NOTHING_TO_PAY } };
  if (d.status !== "scheduled") return { error: { ok: false, error: NEEDS_SLOT } };
  const isPayer = payerOf(d) === actorId;
  if (as === "payer" && !isPayer) return { error: { ok: false, error: NOT_PAYER } };
  if (as === "payee" && isPayer) return { error: { ok: false, error: NOT_PAYEE } };
  return checked;
}

/**
 * What one payment step comes to: refused with a message, done (the other person
 * is told, `key` names the event so a repeat is not told twice), or already
 * the case, so nothing changes and nobody is told.
 */
type Outcome = { error: string } | { notice: DealNoticeType; key: string; completed?: boolean } | { unchanged: true };

/** Runs one payment step in a transaction and tells the other person. */
async function step(
  args: { actorId: string; dealId: string; alert?: AlertSink },
  as: "payer" | "payee",
  run: (found: LockedDeal, tx: DbTransaction) => Promise<Outcome>,
): Promise<HandoverResult & { completed?: boolean }> {
  let recorded = null as Recorded | null;
  const result = await getDb().transaction(async (tx): Promise<HandoverResult & { completed?: boolean }> => {
    const checked = guard(await lockDeal(tx, args.dealId), args.actorId, as);
    if ("error" in checked) return checked.error;
    const outcome = await run(checked.found, tx);
    if ("error" in outcome) return { ok: false, error: outcome.error };
    if ("unchanged" in outcome) return { ok: true, conversationId: checked.found.conversationId, completed: false };
    recorded = await tellOther(tx, checked.found, args.actorId, outcome.notice, outcome.key);
    return { ok: true, conversationId: checked.found.conversationId, completed: outcome.completed ?? false };
  });
  if (result.ok && recorded?.alert) args.alert?.(recorded.id);
  return result;
}

/**
 * The one being paid asks the other to pay, by one of the online or other ways
 * the post takes (cash is arranged the other way round, see requestCash).
 * Only once a time and place are agreed.
 */
export function askToPay(args: { actorId: string; dealId: string; input?: unknown; alert?: AlertSink; now?: Date }) {
  const now = args.now ?? new Date();
  const parsed = askSchema.safeParse(args.input ?? {});
  return step(args, "payee", async (found, tx) => {
    if (!parsed.success) return { error: NO_MODE };
    if (paymentStage(found) === "cash_requested") return { error: CASH_WAITING };
    if (paymentStage(found) !== "open" && paymentStage(found) !== "asked") return { error: ALREADY_SECURED };
    const ways = paymentModesOf(found).filter((m): m is "online" | "other" => m !== "cash");
    const method = parsed.data.method ?? (ways.length === 1 ? ways[0] : undefined);
    if (!method) return { error: ways.length === 0 ? "This post takes cash only. They can ask to pay cash in person." : NO_MODE };
    if (!ways.includes(method)) return { error: MODE_NOT_TAKEN };
    await tx.update(deal).set({ paymentAskedAt: now, paymentAskMethod: method, ...touched(now) }).where(eq(deal.id, found.id));
    return { notice: "deal_payment_requested", key: `asked:${now.getTime()}` };
  });
}

/**
 * The one paying says they paid, the way they were asked to. This secures the
 * slot: it can no longer be cancelled. The one being paid is told, and confirms.
 */
export function markPaid(args: { actorId: string; dealId: string; alert?: AlertSink; now?: Date }) {
  const now = args.now ?? new Date();
  return step(args, "payer", async (found, tx) => {
    const stage = paymentStage(found);
    if (stage === "paid" || stage === "confirmed") return { unchanged: true };
    if (isCashStage(stage)) return { error: "You agreed to pay cash in person, so there is nothing to pay in advance." };
    if (!found.paymentAskedAt || !found.paymentAskMethod) return { error: NOT_ASKED };
    await tx.update(deal).set({ paidAt: now, paymentMethod: found.paymentAskMethod, cashRequestedAt: null, ...touched(now) }).where(eq(deal.id, found.id));
    return { notice: "deal_paid", key: `paid:${now.getTime()}` };
  });
}

export type PaymentConfirmResult = HandoverResult & { completed?: boolean };

/**
 * The one being paid confirms they received it. If both have confirmed the
 * handover too, the deal completes (and the post is fulfilled when every unit
 * has been handed over). The payer is told.
 */
export function confirmPayment(args: { actorId: string; dealId: string; alert?: AlertSink; now?: Date }): Promise<PaymentConfirmResult> {
  const now = args.now ?? new Date();
  return step(args, "payee", async (found, tx) => {
    if (!found.paidAt) return { error: NOT_PAID_YET };
    if (found.paymentConfirmedAt) return { unchanged: true };
    const completed = readyToComplete({ ...found, paymentConfirmedAt: now });
    await tx
      .update(deal)
      .set({ paymentConfirmedAt: now, ...(completed ? { status: "completed" } : {}), ...touched(now) })
      .where(eq(deal.id, found.id));
    if (completed) await syncAvailability(tx, found.postId, now);
    return { notice: completed ? "deal_completed" : "deal_payment_confirmed", key: completed ? `completed:${args.actorId}` : "payment-confirmed", completed };
  });
}

/**
 * The one being paid says they did not receive what the payer says they paid.
 * That undoes the "paid" (and with it the secured slot), and the payer is told:
 * they can pay again, or report what happened. Not possible once confirmed.
 */
export function rejectPayment(args: { actorId: string; dealId: string; alert?: AlertSink; now?: Date }) {
  const now = args.now ?? new Date();
  return step(args, "payee", async (found, tx) => {
    if (!found.paidAt) return { error: NOT_PAID_YET };
    if (found.paymentConfirmedAt) return { error: "You already confirmed this payment." };
    await tx.update(deal).set({ paidAt: null, paymentMethod: null, ...touched(now) }).where(eq(deal.id, found.id));
    return { notice: "deal_payment_rejected", key: `rejected:${now.getTime()}` };
  });
}

/** The one paying asks to pay cash in person, at the handover. The one being paid agrees or not. */
export function requestCash(args: { actorId: string; dealId: string; alert?: AlertSink; now?: Date }) {
  const now = args.now ?? new Date();
  return step(args, "payer", async (found, tx) => {
    const stage = paymentStage(found);
    if (stage === "paid" || stage === "confirmed" || isCashStage(stage)) return { error: ALREADY_SECURED };
    if (!paymentModesOf(found).includes("cash" satisfies PaymentMode)) return { error: NO_CASH };
    if (stage === "cash_requested") return { unchanged: true };
    await tx.update(deal).set({ cashRequestedAt: now, ...touched(now) }).where(eq(deal.id, found.id));
    return { notice: "deal_cash_requested", key: `cash-requested:${now.getTime()}` };
  });
}

/**
 * The one being paid agrees to the cash request (this secures the slot: neither
 * can cancel, and the cash changes hands at the handover) or declines it. The
 * payer is told. Agreeing does not settle the payment: that takes giveCash and
 * receiveCash.
 */
export function answerCash(args: { actorId: string; dealId: string; agree: boolean; alert?: AlertSink; now?: Date }) {
  const now = args.now ?? new Date();
  return step(args, "payee", async (found, tx) => {
    const stage = paymentStage(found);
    if (isCashStage(stage)) return args.agree ? { unchanged: true } : { error: ALREADY_SECURED };
    if (stage !== "cash_requested") return { error: NO_CASH_REQUEST };
    await tx
      .update(deal)
      .set(args.agree ? { cashAgreedAt: now, ...touched(now) } : { cashRequestedAt: null, ...touched(now) })
      .where(eq(deal.id, found.id));
    return { notice: "deal_cash_answered", key: `cash-${args.agree ? "agreed" : "declined"}:${now.getTime()}` };
  });
}

/**
 * The one paying says they gave the cash, when it really changed hands at the
 * handover. Only after the payee agreed to cash in person. The one being paid
 * is told and confirms receiving it.
 */
export function giveCash(args: { actorId: string; dealId: string; alert?: AlertSink; now?: Date }) {
  const now = args.now ?? new Date();
  return step(args, "payer", async (found, tx) => {
    const stage = paymentStage(found);
    if (stage === "cash_given" || stage === "cash_received") return { unchanged: true };
    if (stage !== "cash_agreed") return { error: CASH_NOT_AGREED };
    await tx.update(deal).set({ cashGivenAt: now, ...touched(now) }).where(eq(deal.id, found.id));
    return { notice: "deal_cash_given", key: `cash-given:${now.getTime()}` };
  });
}

/**
 * The one being paid says they received the cash, when it really changed hands.
 * Only after the payer said they gave it. This settles the payment: if both
 * have confirmed the handover too, the deal completes (and the post is
 * fulfilled when every unit has been handed over). The payer is told.
 */
export function receiveCash(args: { actorId: string; dealId: string; alert?: AlertSink; now?: Date }): Promise<PaymentConfirmResult> {
  const now = args.now ?? new Date();
  return step(args, "payee", async (found, tx) => {
    if (!found.cashGivenAt) return { error: CASH_NOT_GIVEN };
    if (found.cashReceivedAt) return { unchanged: true };
    const completed = readyToComplete({ ...found, cashReceivedAt: now });
    await tx
      .update(deal)
      .set({ cashReceivedAt: now, ...(completed ? { status: "completed" } : {}), ...touched(now) })
      .where(eq(deal.id, found.id));
    if (completed) await syncAvailability(tx, found.postId, now);
    return { notice: completed ? "deal_completed" : "deal_cash_received", key: completed ? `completed:${args.actorId}` : "cash-received", completed };
  });
}

/**
 * The one being paid says they did not receive the cash the payer says they
 * gave. That undoes "given" (the cash stays agreed, so the slot stays secured)
 * and the payer is told: they can say it again, or report what happened. Not
 * possible once received.
 */
export function rejectCash(args: { actorId: string; dealId: string; alert?: AlertSink; now?: Date }) {
  const now = args.now ?? new Date();
  return step(args, "payee", async (found, tx) => {
    if (!found.cashGivenAt) return { error: CASH_NOT_GIVEN };
    if (found.cashReceivedAt) return { error: "You already confirmed the cash." };
    await tx.update(deal).set({ cashGivenAt: null, ...touched(now) }).where(eq(deal.id, found.id));
    return { notice: "deal_payment_rejected", key: `cash-rejected:${now.getTime()}` };
  });
}
