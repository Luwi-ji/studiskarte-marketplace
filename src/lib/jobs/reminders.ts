import { and, eq, gt, gte, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { deal, offer, post } from "@/db/schema";
import { getDb } from "@/lib/db";
import { BEFORE_REMINDERS, CONFIRM_REMINDER_DAYS } from "@/lib/deals/handover";
import { noticeDetail } from "@/lib/deals/notice-detail";
import { payerOf } from "@/lib/deals/payment";
import { recordNotification, type AlertSink } from "@/lib/notifications/record";

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * Reminders about scheduled handovers, each sent once (the notification's own
 * once-key, which includes the scheduled time, so a rescheduled handover is
 * reminded again for its new time). Each carries the agreed time and place, and
 * moves the reservation's card to the bottom of the thread:
 * - to both people, a day and two hours before the time;
 * - to whoever has not confirmed, 1 and 3 days after the time, when the
 *   other has confirmed already;
 * - once both have confirmed the handover but the money step is still waiting,
 *   to the one it waits on, 1 and 3 days after the second confirmation (only the
 *   latest of these that is due, so a late run never sends both).
 * Returns how many notices were written.
 */
export async function sendHandoverReminders(now = new Date(), alert?: AlertSink): Promise<number> {
  const db = getDb();
  let sent = 0;
  type Due = { id: string; postId: string; conversationId: string; scheduledAt: Date | null; place: string | null };
  const tell = async (d: Due, recipientId: string, type: "deal_reminder" | "deal_confirm_reminder", key: string) => {
    const recorded = await recordNotification(db, {
      type,
      recipientId,
      postId: d.postId,
      conversationId: d.conversationId,
      onceKey: `deal:${d.id}:${key}`,
      detail: noticeDetail({ scheduledAt: d.scheduledAt, place: d.place, proposedAt: null, proposedPlace: null }, type),
    });
    if (recorded) {
      sent += 1;
      await db.update(deal).set({ activityAt: now }).where(eq(deal.id, d.id));
      if (recorded.alert) alert?.(recorded.id);
    }
  };
  const columns = {
    id: deal.id,
    postId: deal.postId,
    ownerId: deal.ownerId,
    responderId: deal.responderId,
    scheduledAt: deal.scheduledAt,
    place: deal.place,
    conversationId: offer.conversationId,
  };

  for (const { key, minutes } of BEFORE_REMINDERS) {
    const due = await db
      .select(columns)
      .from(deal)
      .innerJoin(offer, eq(offer.id, deal.offerId))
      .where(and(eq(deal.status, "scheduled"), gt(deal.scheduledAt, now), lte(deal.scheduledAt, new Date(now.getTime() + minutes * MINUTE_MS))));
    for (const d of due) {
      if (!d.scheduledAt) continue;
      for (const recipientId of [d.ownerId, d.responderId]) await tell(d, recipientId, "deal_reminder", `remind:${key}:${d.scheduledAt.getTime()}`);
    }
  }

  for (const days of CONFIRM_REMINDER_DAYS) {
    const waiting = await db
      .select({ ...columns, ownerConfirmedAt: deal.ownerConfirmedAt, responderConfirmedAt: deal.responderConfirmedAt })
      .from(deal)
      .innerJoin(offer, eq(offer.id, deal.offerId))
      .where(
        and(
          eq(deal.status, "scheduled"),
          isNotNull(deal.scheduledAt),
          lte(deal.scheduledAt, new Date(now.getTime() - days * DAY_MS)),
          // Exactly one has confirmed.
          or(and(isNotNull(deal.ownerConfirmedAt), isNull(deal.responderConfirmedAt)), and(isNull(deal.ownerConfirmedAt), isNotNull(deal.responderConfirmedAt))),
        ),
      );
    for (const d of waiting) {
      if (!d.scheduledAt) continue;
      await tell(d, d.ownerConfirmedAt ? d.responderId : d.ownerId, "deal_confirm_reminder", `confirm-remind:${days}d:${d.scheduledAt.getTime()}`);
    }
  }

  // Both confirmed the handover, a price is to be paid, and the deal is still not complete: the payment step is open.
  const oldest = Math.min(...CONFIRM_REMINDER_DAYS);
  const unpaid = await db
    .select({
      ...columns,
      postKind: post.kind,
      ownerConfirmedAt: deal.ownerConfirmedAt,
      responderConfirmedAt: deal.responderConfirmedAt,
      cashRequestedAt: deal.cashRequestedAt,
      cashAgreedAt: deal.cashAgreedAt,
      cashGivenAt: deal.cashGivenAt,
      cashReceivedAt: deal.cashReceivedAt,
      paidAt: deal.paidAt,
      paymentConfirmedAt: deal.paymentConfirmedAt,
    })
    .from(deal)
    .innerJoin(offer, eq(offer.id, deal.offerId))
    .innerJoin(post, eq(post.id, deal.postId))
    .where(
      and(
        eq(deal.status, "scheduled"),
        gt(deal.amount, 0),
        isNotNull(deal.ownerConfirmedAt),
        isNotNull(deal.responderConfirmedAt),
        isNull(deal.paymentConfirmedAt),
        isNull(deal.cashReceivedAt),
        gte(sql`${now.toISOString()}::timestamptz - greatest(${deal.ownerConfirmedAt}, ${deal.responderConfirmedAt})`, sql`make_interval(days => ${oldest})`),
      ),
    );
  for (const d of unpaid) {
    if (!d.ownerConfirmedAt || !d.responderConfirmedAt) continue;
    const bothAt = Math.max(d.ownerConfirmedAt.getTime(), d.responderConfirmedAt.getTime());
    const days = [...CONFIRM_REMINDER_DAYS].reverse().find((n) => now.getTime() >= bothAt + n * DAY_MS);
    if (!days) continue;
    const payer = payerOf({ postKind: d.postKind, ownerId: d.ownerId, responderId: d.responderId });
    const payee = payer === d.ownerId ? d.responderId : d.ownerId;
    // Whoever the next money step waits on: the payee when cash was given (confirm it), a payment was made (confirm it) or a cash request is open (answer it); else the payer.
    const waitingOn = d.cashGivenAt || d.paidAt || (d.cashRequestedAt && !d.cashAgreedAt) ? payee : payer;
    await tell(d, waitingOn, "deal_confirm_reminder", `pay-remind:${days}d:${bothAt}`);
  }
  return sent;
}
