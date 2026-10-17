import { and, count, desc, eq, isNull } from "drizzle-orm";
import { notification, post } from "@/db/schema";
import { getDb } from "@/lib/db";
import { asType, notificationHref, type NotificationType } from "@/lib/notifications/text";

const LIST_MAX = 60;

export type NotificationItem = {
  id: string;
  type: NotificationType;
  count: number;
  read: boolean;
  at: Date;
  /** The post's title as it is now. */
  postTitle: string | null;
  /** The agreed time and place, for a deal notice. */
  detail: string | null;
  href: string;
};

/** The student's notifications, newest first. Only ever their own. */
export async function listNotifications(studentId: string): Promise<NotificationItem[]> {
  const rows = await getDb()
    .select({
      id: notification.id,
      type: notification.type,
      count: notification.count,
      readAt: notification.readAt,
      at: notification.createdAt,
      postId: notification.postId,
      conversationId: notification.conversationId,
      postTitle: post.title,
      detail: notification.detail,
    })
    .from(notification)
    .leftJoin(post, eq(post.id, notification.postId))
    .where(eq(notification.recipientId, studentId))
    .orderBy(desc(notification.createdAt), desc(notification.id))
    .limit(LIST_MAX);
  return rows.map((row) => {
    const type = asType(row.type);
    return {
      id: row.id,
      type,
      count: row.count,
      read: row.readAt !== null,
      at: row.at,
      postTitle: row.postTitle,
      detail: row.detail,
      href: notificationHref({ type, postId: row.postId, conversationId: row.conversationId }),
    };
  });
}

/** How many of the student's notifications are unread (the bell). */
export async function countUnreadNotifications(studentId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(notification)
    .where(and(eq(notification.recipientId, studentId), isNull(notification.readAt)));
  return row.n;
}

/** Marks one of the student's own notifications read. Returns whether it was theirs and unread. */
export async function markNotificationRead(studentId: string, id: string): Promise<boolean> {
  const rows = await getDb()
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.id, id), eq(notification.recipientId, studentId), isNull(notification.readAt)))
    .returning({ id: notification.id });
  return rows.length > 0;
}

/** Marks all of the student's notifications read. Returns how many changed. */
export async function markAllNotificationsRead(studentId: string): Promise<number> {
  const rows = await getDb()
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.recipientId, studentId), isNull(notification.readAt)))
    .returning({ id: notification.id });
  return rows.length;
}
