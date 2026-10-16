import { headline, notificationHref, type NotificationType } from "@/lib/notifications/text";

/** What a device alert shows. The body is only the post's title: never message text, never a name. */
export type AlertPayload = { title: string; body: string; url: string; tag: string };

export function buildPayload(n: {
  type: NotificationType;
  count: number;
  postTitle: string | null;
  postId: string | null;
  conversationId: string | null;
}): AlertPayload {
  const url = notificationHref(n);
  return {
    title: headline(n.type, n.count),
    body: n.postTitle ?? "",
    url,
    // A newer alert about the same thing replaces the older one.
    tag: `${n.type}:${url}`,
  };
}
