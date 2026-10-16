import { z } from "zod";
import { CLOSED_ACCOUNT, CLOSED_POST, MESSAGE_MAX } from "@/lib/messaging/rules";
import { PRICE_MAX, QUANTITY_MAX } from "@/lib/posts/schema";

/** A pending offer stays open this long, then expires. [Chosen 2026-10-16, phase 10; the owner may change it.] */
export const OFFER_DAYS = 3;

export const RESERVED_POST = "This post is fully reserved, so it takes no new offers.";
export const PENDING_OFFER = "You already have a pending offer on this post. Withdraw it first.";
export const HAS_RESERVATION = "You already have a reservation on this post. Open it in your messages to manage it.";

export type OfferKind = "offer" | "reserve";

const inputSchema = z.object({
  kind: z.enum(["offer", "reserve"]),
  amount: z.string().max(12).default(""),
  quantity: z.string().max(8).default("1"),
  note: z.string().max(MESSAGE_MAX * 2).default(""),
});

export type OfferData = { kind: OfferKind; amount: number | null; quantity: number; note: string | null };

export type ParsedOffer =
  | { ok: true; data: OfferData }
  | { ok: false; error: string; field?: "amount" | "quantity" | "note" };

/**
 * Checks what the browser sent. An offer needs a whole-peso amount from ₱1 to
 * ₱1,000,000 (per unit). A reserve has no amount of its own: it is at the
 * post's price. Both ask for a number of units, from 1 to 1,000. The note
 * (optional, up to 2,000 characters) goes with the offer card.
 */
export function parseOffer(input: unknown): ParsedOffer {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That offer could not be sent. Check it and try again." };
  const note = parsed.data.note.trim();
  if (note.length > MESSAGE_MAX) return { ok: false, error: `Notes can be up to ${MESSAGE_MAX.toLocaleString("en-PH")} characters.`, field: "note" };

  const digits = parsed.data.quantity.trim();
  const quantity = /^\d{1,4}$/.test(digits) ? Number(digits) : NaN;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > QUANTITY_MAX) {
    return { ok: false, error: `Enter how many, from 1 to ${QUANTITY_MAX.toLocaleString("en-PH")}.`, field: "quantity" };
  }
  if (parsed.data.kind === "reserve") return { ok: true, data: { kind: "reserve", amount: null, quantity, note: note || null } };

  const text = parsed.data.amount.trim();
  const amount = /^\d{1,7}$/.test(text) ? Number(text) : NaN;
  if (!Number.isInteger(amount) || amount < 1 || amount > PRICE_MAX) {
    return { ok: false, error: `Enter a whole amount from ₱1 to ₱${PRICE_MAX.toLocaleString("en-PH")}.`, field: "amount" };
  }
  return { ok: true, data: { kind: "offer", amount, quantity, note: note || null } };
}

/** What the responder may do about a post right now: make an offer, reserve, or neither (with the reason). */
export type OfferOptions = {
  offer: boolean;
  reserve: boolean;
  /** The most units they can ask for: what is left, or 1,000 when the post is ongoing. */
  maxQuantity: number;
  reason: string | null;
};

/**
 * Offers are open on a post that is open (not expired) and has units left.
 * Reserved (fully taken), closed, expired and hidden posts take none, and
 * neither does a post where this buyer already has a reservation or an offer
 * waiting for the owner. A free post
 * can only be reserved (there is no price to bargain over), and a negotiable
 * post can only get an offer (there is no asking price to reserve at). A post
 * with an amount takes both. `unitsLeft` is null when the post is ongoing.
 */
export function offerOptions(args: {
  priceKind: string;
  postStatus: string;
  postExpiresAt: Date;
  ownerStatus: string;
  responderStatus: string;
  unitsLeft: number | null;
  hasActiveDeal: boolean;
  /** The buyer has an offer here that is waiting for the owner. */
  hasPendingOffer: boolean;
  now?: Date;
}): OfferOptions {
  const none = (reason: string): OfferOptions => ({ offer: false, reserve: false, maxQuantity: 0, reason });
  const now = args.now ?? new Date();
  if (args.ownerStatus !== "active" || args.responderStatus !== "active") return none(CLOSED_ACCOUNT);
  if (args.postStatus === "reserved" || args.unitsLeft === 0) return none(RESERVED_POST);
  if (args.postStatus !== "open" || args.postExpiresAt.getTime() <= now.getTime()) return none(CLOSED_POST);
  if (args.hasActiveDeal) return none(HAS_RESERVATION);
  if (args.hasPendingOffer) return none(PENDING_OFFER);
  return {
    offer: args.priceKind === "amount" || args.priceKind === "negotiable",
    reserve: args.priceKind === "amount" || args.priceKind === "free",
    maxQuantity: args.unitsLeft ?? QUANTITY_MAX,
    reason: null,
  };
}

/** Button wording. For a Wishlist post the responder is offering to supply the item. */
export function offerLabels(postKind: string): { offer: string; reserve: string } {
  return postKind === "wishlist" ? { offer: "Offer a price", reserve: "Supply it" } : { offer: "Make offer", reserve: "Reserve" };
}

const OFFER_STATE: Record<string, string> = {
  declined: "Offer declined",
  withdrawn: "Offer withdrawn",
  expired: "Offer expired",
};

/**
 * Where a listing's transaction stands, from its latest offer in the thread
 * (and the reservation made from it), or null when there has been no offer.
 */
export function transactionLabel(
  latest: { isReserve: boolean; status: string; expiresAt: Date; dealStatus: string | null } | null,
  now = new Date(),
): string | null {
  if (!latest) return null;
  if (latest.status === "pending") {
    if (latest.expiresAt.getTime() <= now.getTime()) return OFFER_STATE.expired;
    return latest.isReserve ? "Reservation waiting" : "Offer waiting";
  }
  if (latest.status === "accepted") {
    if (latest.dealStatus === "cancelled") return "Reservation cancelled";
    return latest.dealStatus === "completed" ? "Completed" : "Reserved";
  }
  return OFFER_STATE[latest.status] ?? null;
}
