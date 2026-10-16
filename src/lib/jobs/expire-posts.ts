import { and, eq, exists, inArray, lte, not } from "drizzle-orm";
import { deal, post } from "@/db/schema";
import { getDb } from "@/lib/db";
import { ACTIVE_STATUSES } from "@/lib/deals/capacity";
import { expiryKey, recordNotification, type AlertSink } from "@/lib/notifications/record";

/**
 * Handles open posts whose 30 days have passed. A post with reservations still
 * being carried out is not expired: it stays reserved (no new offers) until
 * they are done or cancelled, so nobody's reservation is cut off. Any other
 * is moved to "expired" and its owner is told once (the notice is keyed to
 * the listing, so a run that repeats adds nothing). Safe to run twice.
 * Returns how many posts expired.
 */
export async function expirePosts(now = new Date(), alert?: AlertSink): Promise<number> {
  const db = getDb();
  const hasActiveDeal = exists(db.select({ one: deal.id }).from(deal).where(and(eq(deal.postId, post.id), inArray(deal.status, [...ACTIVE_STATUSES]))));
  await db
    .update(post)
    .set({ status: "reserved", updatedAt: now })
    .where(and(eq(post.status, "open"), lte(post.expiresAt, now), hasActiveDeal));

  const expired = await db
    .update(post)
    .set({ status: "expired", updatedAt: now })
    .where(and(eq(post.status, "open"), lte(post.expiresAt, now), not(hasActiveDeal)))
    .returning({ id: post.id, ownerId: post.ownerId, listedAt: post.listedAt });
  for (const row of expired) {
    const recorded = await recordNotification(db, {
      type: "post_expired",
      recipientId: row.ownerId,
      postId: row.id,
      onceKey: expiryKey("expired", row.id, row.listedAt),
    });
    if (recorded?.alert) alert?.(recorded.id);
  }
  return expired.length;
}
