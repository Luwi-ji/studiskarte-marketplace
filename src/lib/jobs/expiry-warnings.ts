import { and, eq, gt, lte } from "drizzle-orm";
import { post } from "@/db/schema";
import { getDb } from "@/lib/db";
import { expiryKey, recordNotification, type AlertSink } from "@/lib/notifications/record";

/** Owners are warned this long before a listing expires. */
export const WARNING_DAYS = 3;

/**
 * Tells the owner of each open post that expires within 3 days, once per
 * listing (a relist is a new listing, so it can warn again). Safe to run as
 * often as you like: a post already warned about is skipped.
 */
export async function warnExpiringPosts(now = new Date(), alert?: AlertSink): Promise<number> {
  const db = getDb();
  const soon = new Date(now.getTime() + WARNING_DAYS * 24 * 60 * 60 * 1000);
  const posts = await db
    .select({ id: post.id, ownerId: post.ownerId, listedAt: post.listedAt })
    .from(post)
    .where(and(eq(post.status, "open"), gt(post.expiresAt, now), lte(post.expiresAt, soon)));
  let warned = 0;
  for (const row of posts) {
    const recorded = await recordNotification(db, {
      type: "post_expiring",
      recipientId: row.ownerId,
      postId: row.id,
      onceKey: expiryKey("expiring", row.id, row.listedAt),
    });
    if (recorded) {
      warned += 1;
      if (recorded.alert) alert?.(recorded.id);
    }
  }
  return warned;
}
