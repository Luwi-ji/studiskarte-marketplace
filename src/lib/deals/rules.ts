import { z } from "zod";
import { CLOSED_ACCOUNT, CLOSED_POST, MESSAGE_MAX } from "@/lib/messaging/rules";
import { PRICE_MAX } from "@/lib/posts/schema";

/** A pending offer stays open this long, then expires. [Chosen 2026-10-16, phase 10; the owner may change it.] */
export const OFFER_DAYS = 3;

export const RESERVED_POST = "This post is reserved, so it takes no new offers.";

export type OfferKind = "offer" | "reserve";

const inputSchema = z.object({
  kind: z.enum(["offer", "reserve"]),
  amount: z.string().max(12).default(""),
  note: z.string().max(MESSAGE_MAX * 2).default(""),
});

export type OfferData = { kind: OfferKind; amount: number | null; note: string | null };

export type ParsedOffer = { ok: true; data: OfferData } | { ok: false; error: string; field?: "amount" | "note" };

/**
 * Checks what the browser sent. An offer needs a whole-peso amount from ₱1 to
 * ₱1,000,000. A reserve has no amount of its own: it is at the post's price.
 * The note (optional, up to 2,000 characters) goes with the offer card.
 */
export function parseOffer(input: unknown): ParsedOffer {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That offer could not be sent. Check it and try again." };
  const note = parsed.data.note.trim();
  if (note.length > MESSAGE_MAX) return { ok: false, error: `Notes can be up to ${MESSAGE_MAX.toLocaleString("en-PH")} characters.`, field: "note" };
  if (parsed.data.kind === "reserve") return { ok: true, data: { kind: "reserve", amount: null, note: note || null } };

  const text = parsed.data.amount.trim();
  const amount = /^\d{1,7}$/.test(text) ? Number(text) : NaN;
  if (!Number.isInteger(amount) || amount < 1 || amount > PRICE_MAX) {
    return { ok: false, error: `Enter a whole amount from ₱1 to ₱${PRICE_MAX.toLocaleString("en-PH")}.`, field: "amount" };
  }
  return { ok: true, data: { kind: "offer", amount, note: note || null } };
}

/** What the responder may do about a post right now: make an offer, reserve, or neither (with the reason). */
export type OfferOptions = { offer: boolean; reserve: boolean; reason: string | null };

/**
 * Offers are open on a post that is open (not expired). Reserved, closed,
 * expired and hidden posts take none. A free post can only be reserved
 * (there is no price to bargain over), and a negotiable post can only get an
 * offer (there is no asking price to reserve at). A post with an amount takes both.
 */
export function offerOptions(args: {
  priceKind: string;
  postStatus: string;
  postExpiresAt: Date;
  ownerStatus: string;
  responderStatus: string;
  now?: Date;
}): OfferOptions {
  const none = (reason: string): OfferOptions => ({ offer: false, reserve: false, reason });
  const now = args.now ?? new Date();
  if (args.ownerStatus !== "active" || args.responderStatus !== "active") return none(CLOSED_ACCOUNT);
  if (args.postStatus === "reserved") return none(RESERVED_POST);
  if (args.postStatus !== "open" || args.postExpiresAt.getTime() <= now.getTime()) return none(CLOSED_POST);
  return {
    offer: args.priceKind === "amount" || args.priceKind === "negotiable",
    reserve: args.priceKind === "amount" || args.priceKind === "free",
    reason: null,
  };
}

/** Button wording. For a Wishlist post the responder is offering to supply the item. */
export function offerLabels(postKind: string): { offer: string; reserve: string } {
  return postKind === "wishlist" ? { offer: "Offer a price", reserve: "Supply it" } : { offer: "Make offer", reserve: "Reserve" };
}
