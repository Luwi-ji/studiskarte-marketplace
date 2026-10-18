import { and, eq, gt, lte } from "drizzle-orm";
import { deal, offer, review } from "@/db/schema";
import { getDb } from "@/lib/db";
import { recordNotification, type AlertSink } from "@/lib/notifications/record";

const DAY_MS = 86_400_000;

/** A reminder is sent this long after the deal completed... */
export const REVIEW_REMIND_AFTER_DAYS = 1;
/** ...and only for deals that completed within this many days, so a first run never reminds about old deals. */
export const REVIEW_REMIND_WITHIN_DAYS = 14;

/**
 * Reminds each person of a recently completed deal to rate the other, once per
 * deal (the notification's own once-key), unless they already did. The deal
 * itself is left as it is. Returns how many notices were written.
 */
export async function sendReviewReminders(now = new Date(), alert?: AlertSink): Promise<number> {
  const db = getDb();
  let sent = 0;
  const due = await db
    .select({ id: deal.id, postId: deal.postId, ownerId: deal.ownerId, responderId: deal.responderId, conversationId: offer.conversationId })
    .from(deal)
    .innerJoin(offer, eq(offer.id, deal.offerId))
    .where(
      and(
        eq(deal.status, "completed"),
        lte(deal.updatedAt, new Date(now.getTime() - REVIEW_REMIND_AFTER_DAYS * DAY_MS)),
        gt(deal.updatedAt, new Date(now.getTime() - REVIEW_REMIND_WITHIN_DAYS * DAY_MS)),
      ),
    );
  for (const d of due) {
    for (const recipientId of [d.ownerId, d.responderId]) {
      const [reviewed] = await db.select({ id: review.id }).from(review).where(and(eq(review.dealId, d.id), eq(review.reviewerId, recipientId)));
      if (reviewed) continue;
      const recorded = await recordNotification(db, {
        type: "deal_review_reminder",
        recipientId,
        postId: d.postId,
        conversationId: d.conversationId,
        onceKey: `deal:${d.id}:review-remind`,
      });
      if (recorded) {
        sent += 1;
        if (recorded.alert) alert?.(recorded.id);
      }
    }
  }
  return sent;
}
