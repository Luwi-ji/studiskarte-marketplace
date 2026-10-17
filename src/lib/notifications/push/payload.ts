import { headline, notificationHref, type NotificationType } from "@/lib/notifications/text";

/**
 * What a device alert shows. The body is the post's title and, for a handover, the
 * agreed time and place on a second line: never message text, never a name or an amount.
 */
export type AlertPayload = { title: string; body: string; url: string; tag: string };

export function buildPayload(n: {
  type: NotificationType;
  count: number;
  postTitle: string | null;
  detail?: string | null;
  postId: string | null;
  conversationId: string | null;
}): AlertPayload {
  const url = notificationHref(n);
  return {
    title: headline(n.type, n.count, n.detail),
    body: [n.postTitle, n.detail].filter(Boolean).join("\n"),
    url,
    // A newer alert about the same thing replaces the older one.
    tag: `${n.type}:${url}`,
  };
}
