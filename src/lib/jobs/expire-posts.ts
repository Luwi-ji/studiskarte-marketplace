import { and, eq, lte } from "drizzle-orm";
import { post } from "@/db/schema";
import { getDb } from "@/lib/db";
import { expiryKey, recordNotification, type AlertSink } from "@/lib/notifications/record";

/**
 * Moves open posts whose 30 days have passed to "expired", and tells each
 * owner once (the notice is keyed to the listing, so a run that repeats adds
 * nothing). Reserved posts are left alone: they do not expire while a deal is
 * active. Safe to run twice: a second run finds nothing left to change.
 */
export async function expirePosts(now = new Date(), alert?: AlertSink): Promise<number> {
  const db = getDb();
  const expired = await db
    .update(post)
    .set({ status: "expired", updatedAt: now })
    .where(and(eq(post.status, "open"), lte(post.expiresAt, now)))
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
