import type { NotificationType } from "@/lib/notifications/text";

/**
 * What an open conversation says, while it updates, when the other person just did something: the sentence about
 * what happened, with their name where it says who did it. Reminders are left out: they are not something the other
 * person did.
 */
const LIVE_LABEL: Partial<Record<NotificationType, (who: string) => string>> = {
  message: (who) => `${who} sent a message`,
  offer_received: (who) => `${who} made an offer`,
  offer_accepted: (who) => `${who} accepted your offer`,
  offer_declined: (who) => `${who} declined your offer`,
  offer_expired: () => "The offer expired",
  deal_cancelled: (who) => `${who} cancelled the reservation`,
  deal_proposed: (who) => `${who} proposed a time`,
  deal_scheduled: () => "Time agreed",
  deal_confirmed: (who) => `${who} confirmed the handover`,
  deal_handover_rejected: (who) => `${who} says it did not happen`,
  deal_proposal_declined: (who) => `${who} declined the time`,
  deal_completed: () => "Handover complete",
  deal_expired: () => "Cancelled for inactivity",
  deal_paid: (who) => `${who} marked it paid`,
  deal_payment_confirmed: () => "Payment confirmed",
  deal_payment_requested: (who) => `${who} asked you to pay`,
  deal_cash_requested: (who) => `${who} asked to pay cash`,
  deal_cash_answered: (who) => `${who} answered the cash request`,
  deal_cash_given: (who) => `${who} gave the cash`,
  deal_cash_received: () => "Cash received",
  deal_payment_rejected: (who) => `${who} says the payment was not received`,
  deal_reported: (who) => `${who} reported a problem`,
  deal_disputed: () => "Marked as disputed",
};

/** A long name is cut so the line stays short on a phone. */
const MAX_NAME = 24;

/**
 * The status line for a device alert's tag ("<type>:<url>"): what happened and that the page is catching up
 * ("Sam accepted your offer. Updating…"), or null when the alert is not about a step.
 */
export function liveLabel(tag: string, who: string): string | null {
  const type = tag.split(":", 1)[0] as NotificationType;
  const what = LIVE_LABEL[type];
  if (!what) return null;
  const letters = [...who];
  const name = letters.length > MAX_NAME ? `${letters.slice(0, MAX_NAME - 1).join("")}…` : who;
  return `${what(name)}. ${type === "deal_cash_received" ? "Confirming…" : "Updating…"}`;
}
