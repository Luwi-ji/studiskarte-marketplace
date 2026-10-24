import type { NotificationType } from "@/lib/notifications/text";

/**
 * What an open conversation says, while it updates, when the other person just did something.
 * Reminders are left out: they are not something the other person did.
 */
const LIVE_LABEL: Partial<Record<NotificationType, string>> = {
  message: "New message. Updating…",
  offer_received: "They made an offer. Updating…",
  offer_accepted: "They accepted. Updating…",
  offer_declined: "They declined. Updating…",
  offer_expired: "The offer expired. Updating…",
  deal_cancelled: "They cancelled. Updating…",
  deal_proposed: "They proposed a time. Updating…",
  deal_scheduled: "Time agreed. Updating…",
  deal_confirmed: "They confirmed the handover. Updating…",
  deal_handover_rejected: "They say it did not happen. Updating…",
  deal_proposal_declined: "They declined the time. Updating…",
  deal_completed: "Handover complete. Updating…",
  deal_expired: "Cancelled for inactivity. Updating…",
  deal_paid: "They marked it paid. Updating…",
  deal_payment_confirmed: "Payment confirmed. Updating…",
  deal_payment_requested: "They asked you to pay. Updating…",
  deal_cash_requested: "They asked to pay cash. Updating…",
  deal_cash_answered: "They answered the cash request. Updating…",
  deal_cash_given: "They gave the cash. Updating…",
  deal_cash_received: "Cash received. Confirming…",
  deal_payment_rejected: "They say the payment was not received. Updating…",
  deal_reported: "A problem was reported. Updating…",
  deal_disputed: "Marked as disputed. Updating…",
};

/** The status line for a device alert's tag ("<type>:<url>"), or null when the alert is not about a step. */
export function liveLabel(tag: string): string | null {
  const type = tag.split(":", 1)[0] as NotificationType;
  return LIVE_LABEL[type] ?? null;
}
