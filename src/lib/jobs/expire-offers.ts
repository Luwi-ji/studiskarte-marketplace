import { and, eq, inArray, lte, ne, or } from "drizzle-orm";
import { conversation, offer, post } from "@/db/schema";
import { getDb } from "@/lib/db";
import { offerKey, recordNotification, type AlertSink } from "@/lib/notifications/record";

/**
 * Expires pending offers whose time has run out, or whose post is no longer
 * open (expired, withdrawn, closed). The responder is told once. An offer that
 * expired stays expired when the post is relisted; they can offer again.
 * Safe to run twice: a second run finds nothing pending to change.
 */
export async function expireOffers(now = new Date(), alert?: AlertSink): Promise<number> {
  const db = getDb();
  const stale = await db
    .select({ id: offer.id, conversationId: offer.conversationId, postId: post.id, responderId: conversation.responderId })
    .from(offer)
    .innerJoin(conversation, eq(conversation.id, offer.conversationId))
    .innerJoin(post, eq(post.id, conversation.postId))
    .where(and(eq(offer.status, "pending"), or(lte(offer.expiresAt, now), ne(post.status, "open"), lte(post.expiresAt, now))));
  if (stale.length === 0) return 0;

  const expired = await db
    .update(offer)
    .set({ status: "expired", decidedAt: now })
    .where(
      and(
        eq(offer.status, "pending"),
        inArray(
          offer.id,
          stale.map((s) => s.id),
        ),
      ),
    )
    .returning({ id: offer.id });
  const done = new Set(expired.map((e) => e.id));
  for (const s of stale.filter((row) => done.has(row.id))) {
    const recorded = await recordNotification(db, {
      type: "offer_expired",
      recipientId: s.responderId,
      postId: s.postId,
      conversationId: s.conversationId,
      onceKey: offerKey(s.id, "expired"),
    });
    if (recorded?.alert) alert?.(recorded.id);
  }
  return expired.length;
}
