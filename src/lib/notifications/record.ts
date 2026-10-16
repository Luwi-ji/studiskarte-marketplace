import { eq, sql } from "drizzle-orm";
import { notification, student } from "@/db/schema";
import type { Executor } from "@/lib/db";

export type NotificationSpec =
  | { type: "message"; recipientId: string; postId: string; conversationId: string }
  | { type: "heart"; recipientId: string; postId: string }
  | { type: "post_expiring" | "post_expired"; recipientId: string; postId: string; onceKey: string }
  | {
      type: "offer_received" | "offer_accepted" | "offer_declined" | "offer_expired";
      recipientId: string;
      postId: string;
      conversationId: string;
      onceKey: string;
    };

/** The entry that was written, and whether a device alert should go with it. */
export type Recorded = { id: string; alert: boolean };

/** Calls back after the change is saved, when a device alert should be sent for this notification. */
export type AlertSink = (notificationId: string) => void;

/**
 * Writes a notification for someone other than the person who caused it.
 * - message and heart fold into the recipient's unread entry for the same
 *   conversation or post (count goes up, time moves on), so a busy chat is one
 *   line. A new message always asks for an alert; a heart only the first time.
 * - expiry notices happen once per listing and are skipped if already written.
 * Nothing is written for a recipient who is not active (suspended, deleted).
 */
export async function recordNotification(db: Executor, spec: NotificationSpec): Promise<Recorded | null> {
  const [recipient] = await db.select({ status: student.accountStatus }).from(student).where(eq(student.id, spec.recipientId));
  if (!recipient || recipient.status !== "active") return null;

  if (spec.type !== "message" && spec.type !== "heart") {
    const [row] = await db
      .insert(notification)
      .values({
        recipientId: spec.recipientId,
        type: spec.type,
        postId: spec.postId,
        conversationId: "conversationId" in spec ? spec.conversationId : null,
        onceKey: spec.onceKey,
      })
      .onConflictDoNothing()
      .returning({ id: notification.id });
    return row ? { id: row.id, alert: true } : null;
  }

  const foldKey = spec.type === "message" ? spec.conversationId : spec.postId;
  const [row] = await db
    .insert(notification)
    .values({
      recipientId: spec.recipientId,
      type: spec.type,
      postId: spec.postId,
      conversationId: spec.type === "message" ? spec.conversationId : null,
      foldKey,
    })
    .onConflictDoUpdate({
      target: [notification.recipientId, notification.type, notification.foldKey],
      targetWhere: sql`${notification.readAt} is null and ${notification.foldKey} is not null`,
      set: { count: sql`${notification.count} + 1`, createdAt: sql`now()` },
    })
    .returning({ id: notification.id, inserted: sql<boolean>`(xmax = 0)` });
  return { id: row.id, alert: spec.type === "message" || row.inserted };
}

/** One notice per offer and outcome, however many times a job runs. */
export function offerKey(offerId: string, outcome: "received" | "accepted" | "declined" | "expired"): string {
  return `offer:${offerId}:${outcome}`;
}

/** Keys an expiry notice to the listing it belongs to: a relist is a new listing. */
export function expiryKey(kind: "expiring" | "expired", postId: string, listedAt: Date): string {
  return `${kind}:${postId}:${listedAt.getTime()}`;
}
