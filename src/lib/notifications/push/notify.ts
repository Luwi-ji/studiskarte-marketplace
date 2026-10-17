import { eq } from "drizzle-orm";
import webpush from "web-push";
import { notification, post, pushSubscription, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { buildPayload } from "@/lib/notifications/push/payload";
import { asType } from "@/lib/notifications/text";

export type PushTarget = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Sends one payload to one device. Rejects with a `statusCode` when the push service refuses. */
export type PushSender = (target: PushTarget, payload: string) => Promise<unknown>;

/** Alerts need the three VAPID settings; without them the app still works, with the in-app list only. */
export function alertsConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

const sendWithWebPush: PushSender = (target, payload) =>
  webpush.sendNotification(target, payload, {
    TTL: 24 * 60 * 60,
    vapidDetails: {
      subject: process.env.VAPID_SUBJECT ?? "",
      publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
      privateKey: process.env.VAPID_PRIVATE_KEY ?? "",
    },
  });

function isGone(error: unknown): boolean {
  return typeof error === "object" && error !== null && "statusCode" in error && (error.statusCode === 404 || error.statusCode === 410);
}

/**
 * Sends the alert for a notification to every device the recipient allowed.
 * A device the push service says is gone is removed. Failures are logged and
 * never thrown: an alert that cannot be delivered must not break the action
 * that caused it, and the notification is still in the app.
 * Nothing is sent to a recipient who is not active.
 */
export async function deliverAlert(notificationId: string, send: PushSender = sendWithWebPush): Promise<{ sent: number; removed: number }> {
  const none = { sent: 0, removed: 0 };
  if (send === sendWithWebPush && !alertsConfigured()) return none;
  try {
    const db = getDb();
    const [n] = await db
      .select({
        recipientId: notification.recipientId,
        type: notification.type,
        count: notification.count,
        postId: notification.postId,
        conversationId: notification.conversationId,
        postTitle: post.title,
        detail: notification.detail,
        recipientStatus: student.accountStatus,
      })
      .from(notification)
      .innerJoin(student, eq(student.id, notification.recipientId))
      .leftJoin(post, eq(post.id, notification.postId))
      .where(eq(notification.id, notificationId));
    if (!n || n.recipientStatus !== "active") return none;

    const subscriptions = await db.select().from(pushSubscription).where(eq(pushSubscription.studentId, n.recipientId));
    if (subscriptions.length === 0) return none;

    const payload = JSON.stringify(buildPayload({ ...n, type: asType(n.type) }));
    const results = await Promise.allSettled(
      subscriptions.map((s) => send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)),
    );
    let sent = 0;
    let removed = 0;
    for (const [index, result] of results.entries()) {
      if (result.status === "fulfilled") {
        sent += 1;
      } else if (isGone(result.reason)) {
        await db.delete(pushSubscription).where(eq(pushSubscription.id, subscriptions[index].id));
        removed += 1;
      } else {
        console.error("could not send an alert", result.reason);
      }
    }
    return { sent, removed };
  } catch (error) {
    console.error("could not deliver an alert", error);
    return none;
  }
}
