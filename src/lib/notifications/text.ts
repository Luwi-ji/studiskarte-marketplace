/** What a notification says, in the list and in a device alert. Never carries message text or a name. */
export type NotificationType = "message" | "heart" | "post_expiring" | "post_expired";

export const NOTIFICATION_TYPES: readonly NotificationType[] = ["message", "heart", "post_expiring", "post_expired"];

/** The type of a stored row. The database allows only these four (a CHECK), so anything else cannot occur. */
export function asType(value: string): NotificationType {
  return value === "message" || value === "heart" || value === "post_expiring" ? value : "post_expired";
}

/** The headline: what happened. The post's title goes under it. */
export function headline(type: NotificationType, count: number): string {
  switch (type) {
    case "message":
      return count === 1 ? "New message" : `${count} new messages`;
    case "heart":
      return count === 1 ? "Someone hearted your post" : `${count} hearts on your post`;
    case "post_expiring":
      return "Your post expires soon";
    case "post_expired":
      return "Your post has expired";
  }
}

/** Where tapping a notification goes. */
export function notificationHref(n: { type: NotificationType; postId: string | null; conversationId: string | null }): string {
  if (n.type === "message" && n.conversationId) return `/messages/${n.conversationId}`;
  return n.postId ? `/posts/${n.postId}` : "/notifications";
}
