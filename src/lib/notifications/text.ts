/** What a notification says, in the list and in a device alert. Never carries message text, an amount, or a name. */
export const NOTIFICATION_TYPES = [
  "message",
  "heart",
  "post_expiring",
  "post_expired",
  "offer_received",
  "offer_accepted",
  "offer_declined",
  "offer_expired",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** The type of a stored row. The database allows only these (a CHECK), so a match always exists. */
export function asType(value: string): NotificationType {
  return NOTIFICATION_TYPES.find((type) => type === value) ?? "post_expired";
}

const HEADLINE: Record<Exclude<NotificationType, "message" | "heart">, string> = {
  post_expiring: "Your post expires soon",
  post_expired: "Your post has expired",
  offer_received: "New offer on your post",
  offer_accepted: "Your offer was accepted",
  offer_declined: "Your offer was declined",
  offer_expired: "Your offer expired",
};

/** The headline: what happened. The post's title goes under it. */
export function headline(type: NotificationType, count: number): string {
  if (type === "message") return count === 1 ? "New message" : `${count} new messages`;
  if (type === "heart") return count === 1 ? "Someone hearted your post" : `${count} hearts on your post`;
  return HEADLINE[type];
}

/** Notifications that open the conversation (messages and everything about an offer). */
function opensConversation(type: NotificationType): boolean {
  return type === "message" || type.startsWith("offer_");
}

/** Where tapping a notification goes. */
export function notificationHref(n: { type: NotificationType; postId: string | null; conversationId: string | null }): string {
  if (opensConversation(n.type) && n.conversationId) return `/messages/${n.conversationId}`;
  return n.postId ? `/posts/${n.postId}` : "/notifications";
}
