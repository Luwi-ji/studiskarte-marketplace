import { and, eq, gt, isNotNull, isNull, lte, or } from "drizzle-orm";
import { deal, offer } from "@/db/schema";
import { getDb } from "@/lib/db";
import { BEFORE_REMINDERS, CONFIRM_REMINDER_DAYS } from "@/lib/deals/handover";
import { recordNotification, type AlertSink } from "@/lib/notifications/record";

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/**
 * Reminders about scheduled handovers, each sent once (the notification's own
 * once-key, which includes the scheduled time, so a rescheduled handover is
 * reminded again for its new time):
 * - to both people, a day and an hour before the time;
 * - to whoever has not confirmed, 1 and 3 days after the time, when the
 *   other has confirmed already.
 * Returns how many notices were written.
 */
export async function sendHandoverReminders(now = new Date(), alert?: AlertSink): Promise<number> {
  const db = getDb();
  let sent = 0;
  const tell = async (d: { id: string; postId: string; conversationId: string }, recipientId: string, type: "deal_reminder" | "deal_confirm_reminder", key: string) => {
    const recorded = await recordNotification(db, { type, recipientId, postId: d.postId, conversationId: d.conversationId, onceKey: `deal:${d.id}:${key}` });
    if (recorded) {
      sent += 1;
      if (recorded.alert) alert?.(recorded.id);
    }
  };
  const columns = {
    id: deal.id,
    postId: deal.postId,
    ownerId: deal.ownerId,
    responderId: deal.responderId,
    scheduledAt: deal.scheduledAt,
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
  return sent;
}
