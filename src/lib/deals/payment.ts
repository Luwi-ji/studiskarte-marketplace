import { eq } from "drizzle-orm";
import { z } from "zod";
import { deal } from "@/db/schema";
import { getDb } from "@/lib/db";
import { syncAvailability } from "@/lib/deals/capacity";
import type { LockedDeal } from "@/lib/deals/lock";
import { lockDeal } from "@/lib/deals/lock";
import { activeFor, tellOther, type HandoverResult } from "@/lib/deals/schedule";
import type { AlertSink, Recorded } from "@/lib/notifications/record";
import { paymentModesOf, type PaymentMode } from "@/lib/payment";

export const NOT_PAYER = "Only the one paying can say it was paid.";
export const NOT_PAYEE = "Only the one being paid can confirm the payment.";
export const NOTHING_TO_PAY = "This one is free, so there is nothing to pay.";
export const NOT_PAID_YET = "Wait until they say they have paid.";
const NO_MODE = "Choose how it was paid.";
const MODE_NOT_TAKEN = "This post does not take that way of paying.";

const inputSchema = z.object({ method: z.enum(["cash", "online", "other"]).optional() });

/** Who pays: on a Showcase the buyer (who reserved), on a Wishlist the one who posted it. */
export function payerOf(d: { postKind: string; ownerId: string; responderId: string }): string {
  return d.postKind === "wishlist" ? d.ownerId : d.responderId;
}

/** The total for the deal: the price each times the units. */
export function dealTotal(d: { amount: number; quantity: number }): number {
  return d.amount * d.quantity;
}

/**
 * A deal is ready to complete when both have confirmed the handover and the
 * payment is confirmed, or there was nothing to pay (a free deal).
 */
export function readyToComplete(d: { ownerConfirmedAt: Date | null; responderConfirmedAt: Date | null; amount: number; paymentConfirmedAt: Date | null }): boolean {
  return d.ownerConfirmedAt !== null && d.responderConfirmedAt !== null && (d.amount === 0 || d.paymentConfirmedAt !== null);
}

function modesOf(found: LockedDeal): PaymentMode[] {
  return paymentModesOf(found);
}

/**
 * The one paying says it was paid, and how (one of the ways the post takes;
 * if it takes only one, that is assumed). The one being paid is told, and
 * confirms. Saying it twice changes nothing.
 */
export async function markPaid(args: { actorId: string; dealId: string; input?: unknown; alert?: AlertSink; now?: Date }): Promise<HandoverResult> {
  const now = args.now ?? new Date();
  const parsed = inputSchema.safeParse(args.input ?? {});
  if (!parsed.success) return { ok: false, error: NO_MODE };
  let recorded = null as Recorded | null;
  const result = await getDb().transaction(async (tx): Promise<HandoverResult> => {
    const checked = activeFor(await lockDeal(tx, args.dealId), args.actorId);
    if ("error" in checked) return checked.error;
    const { found } = checked;
    if (payerOf(found) !== args.actorId) return { ok: false, error: NOT_PAYER };
    if (found.amount === 0) return { ok: false, error: NOTHING_TO_PAY };
    if (found.paidAt) return { ok: true, conversationId: found.conversationId };

    const modes = modesOf(found);
    const method = parsed.data.method ?? (modes.length === 1 ? modes[0] : undefined);
    if (!method) return { ok: false, error: NO_MODE };
    if (!modes.includes(method)) return { ok: false, error: MODE_NOT_TAKEN };

    await tx.update(deal).set({ paymentMethod: method, paidAt: now, updatedAt: now }).where(eq(deal.id, found.id));
    recorded = await tellOther(tx, found, args.actorId, "deal_paid", "paid");
    return { ok: true, conversationId: found.conversationId };
  });
  if (result.ok && recorded?.alert) args.alert?.(recorded.id);
  return result;
}

export type PaymentConfirmResult = HandoverResult | { ok: true; conversationId: string; completed: boolean };

/**
 * The one being paid confirms they received it, once the other has said they
 * paid. If both have confirmed the handover too, the deal completes (and the
 * post is fulfilled when every unit has been handed over). The payer is told.
 */
export async function confirmPayment(args: { actorId: string; dealId: string; alert?: AlertSink; now?: Date }): Promise<PaymentConfirmResult> {
  const now = args.now ?? new Date();
  let recorded = null as Recorded | null;
  const result = await getDb().transaction(async (tx): Promise<PaymentConfirmResult> => {
    const checked = activeFor(await lockDeal(tx, args.dealId), args.actorId);
    if ("error" in checked) return checked.error;
    const { found } = checked;
    if (payerOf(found) === args.actorId) return { ok: false, error: NOT_PAYEE };
    if (found.amount === 0) return { ok: false, error: NOTHING_TO_PAY };
    if (!found.paidAt) return { ok: false, error: NOT_PAID_YET };
    if (found.paymentConfirmedAt) return { ok: true, conversationId: found.conversationId, completed: false };

    const completed = found.status === "scheduled" && readyToComplete({ ...found, paymentConfirmedAt: now });
    await tx
      .update(deal)
      .set({ paymentConfirmedAt: now, ...(completed ? { status: "completed" } : {}), updatedAt: now })
      .where(eq(deal.id, found.id));
    if (completed) await syncAvailability(tx, found.postId, now);
    recorded = await tellOther(tx, found, args.actorId, completed ? "deal_completed" : "deal_payment_confirmed", completed ? `completed:${args.actorId}` : "payment-confirmed");
    return { ok: true, conversationId: found.conversationId, completed };
  });
  if (result.ok && recorded?.alert) args.alert?.(recorded.id);
  return result;
}
