/** What a notification says, in the list and in a device alert. Never carries message text, an amount, or a name. A deal notice may add the agreed time and place (`detail`). */
export const NOTIFICATION_TYPES = [
  "message",
  "heart",
  "post_expiring",
  "post_expired",
  "offer_received",
  "offer_accepted",
  "offer_declined",
  "offer_expired",
  "deal_cancelled",
  "deal_proposed",
  "deal_scheduled",
  "deal_confirmed",
  "deal_handover_rejected",
  "deal_review_reminder",
  "deal_proposal_declined",
  "deal_completed",
  "deal_reminder",
  "deal_confirm_reminder",
  "deal_expired",
  "deal_paid",
  "deal_payment_confirmed",
  "deal_payment_requested",
  "deal_cash_requested",
  "deal_cash_answered",
  "deal_cash_given",
  "deal_cash_received",
  "deal_payment_rejected",
  "deal_reported",
  "deal_disputed",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** The type of a stored row. The database allows only these (a CHECK), so a match always exists. */
export function asType(value: string): NotificationType {
  return NOTIFICATION_TYPES.find((type) => type === value) ?? "post_expired";
}

const HEADLINE: Record<Exclude<NotificationType, "message" | "heart">, string> = {
  post_expiring: "Your post expires soon",
  post_expired: "Your post expired. Relist it within 7 days or it is deleted",
  offer_received: "New offer on your post",
  offer_accepted: "Your offer was accepted",
  offer_declined: "Your offer was declined",
  offer_expired: "Your offer expired",
  deal_cancelled: "A reservation was cancelled",
  deal_proposed: "A time and place was proposed",
  deal_scheduled: "Handover scheduled. Add it to your calendar",
  deal_confirmed: "The other student confirmed the handover",
  deal_handover_rejected: "The other student says the handover did not happen. Talk it over, or report it",
  deal_review_reminder: "How did it go? Rate the other student",
  deal_proposal_declined: "Your proposed time and place was declined",
  deal_completed: "Handover complete",
  deal_reminder: "Your handover is coming up",
  deal_confirm_reminder: "Please confirm your transaction",
  deal_expired: "A reservation was cancelled for inactivity",
  deal_paid: "Payment marked as paid",
  deal_payment_confirmed: "Payment confirmed",
  deal_payment_requested: "You were asked to pay",
  deal_cash_requested: "Cash in person was requested",
  deal_cash_answered: "Your cash request was answered",
  deal_cash_given: "The cash was handed to you? Please confirm",
  deal_cash_received: "Cash received and confirmed",
  deal_payment_rejected: "Payment was not received",
  deal_reported: "A problem was reported on a reservation",
  deal_disputed: "A reservation needs a look: nobody completed it",
};

/** What a reservation that had a time says to do about the calendar, once it is cancelled. */
const REMOVE_FROM_CALENDAR = ". Remove it from your calendar";

/**
 * The headline: what happened. The post's title goes under it. A cancelled
 * reservation that had a time (it has a `detail`) also says to remove it from the calendar.
 */
export function headline(type: NotificationType, count: number, detail?: string | null): string {
  if (type === "message") return count === 1 ? "New message" : `${count} new messages`;
  if (type === "heart") return count === 1 ? "Someone hearted your post" : `${count} hearts on your post`;
  if ((type === "deal_cancelled" || type === "deal_expired") && detail) return HEADLINE[type] + REMOVE_FROM_CALENDAR;
  return HEADLINE[type];
}

/** Notifications that open the conversation (messages and everything about an offer or reservation). */
function opensConversation(type: NotificationType): boolean {
  return type === "message" || type.startsWith("offer_") || type.startsWith("deal_");
}

/** Where tapping a notification goes. */
export function notificationHref(n: { type: NotificationType; postId: string | null; conversationId: string | null }): string {
  if (opensConversation(n.type) && n.conversationId) return `/messages/${n.conversationId}`;
  return n.postId ? `/posts/${n.postId}` : "/notifications";
}
