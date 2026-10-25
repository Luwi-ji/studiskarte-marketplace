import { and, desc, eq, gt, inArray, lte, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { deal, image, offer, post, postPhoto, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { formatHandoverTime } from "@/lib/deals/handover";
import { cashAskedBy, isSecured, paymentStage, type PaymentFields, type PaymentStage } from "@/lib/deals/slot";
import { dealTurn, offerTurn, viewerPays, type Turn } from "@/lib/deals/turn";

/**
 * Where a transaction is: an offer waiting for an answer, a reservation being carried out, or over (completed,
 * cancelled, reported, or an offer that was declined, withdrawn or ran out of time).
 */
export type TransactionGroup = "waiting" | "active" | "done" | "cancelled" | "reported" | "ended";

/** What can still be done to a transaction in one tap, by the same rules as doing it from the conversation. */
export type TransactionAction = "withdraw" | "decline" | "cancel";

/** Offers that came to nothing stay on the list this long. */
export const ENDED_OFFER_DAYS = 60;

export type Transaction = {
  /** The deal's id, or the offer's while it is only an offer. */
  id: string;
  /** The offer's id: the offer's card in its conversation is anchored on it, also once it became a reservation. */
  offerId: string;
  postId: string;
  title: string;
  /** "showcase" or "wishlist". */
  kind: string;
  thumbKey: string;
  otherName: string;
  /** The other person's handle, when they have one. */
  otherHandle: string | null;
  /** The viewer is buying (made the offer) or selling (owns the listing). */
  role: "buying" | "selling";
  quantity: number;
  /** Per unit. */
  amount: number;
  isReserve: boolean;
  group: TransactionGroup;
  /** Whose move it is while ongoing ("none" when nothing is due or it is over); see `dealTurn`. */
  turn: Turn;
  /** One or two words on where it stands: "Waiting", "Reserved", "Declined". */
  chip: string;
  /** One line on where it stands and what comes next. */
  state: string;
  /** What the viewer can still do to it (withdraw their offer, decline one made to them, cancel a reservation), or null. */
  action: TransactionAction | null;
  conversationId: string;
  at: Date;
};

const owner = alias(student, "owner");
const responder = alias(student, "responder");
const cover = alias(image, "cover");

const nameOf = (name: string, handle: string | null) => name || (handle ? `@${handle}` : "Student");

/**
 * What the next step is for a reservation, from the viewer's side.
 * Waiting on you comes first in the words, so it reads as a to-do.
 */
function dealState(d: PaymentFields & {
  status: string;
  scheduledAt: Date | null;
  proposedBy: string | null;
  ownerConfirmedAt: Date | null;
  responderConfirmedAt: Date | null;
  postKind: string;
  viewerIsOwner: boolean;
  viewerId: string;
}): string {
  if (d.status === "completed") return "Completed";
  if (d.status === "cancelled") return "Cancelled";
  if (d.status === "disputed") return "Reported · closed";
  if (d.status === "agreed") {
    if (!d.proposedBy) return "Reserved · agree a time and place";
    return d.proposedBy === d.viewerId ? "Reserved · waiting for them to answer your time" : "Reserved · answer their proposed time";
  }
  // Securing the slot: what the viewer or the other still has to do.
  const pays = viewerPays(d.postKind, d.viewerIsOwner);
  const secure: Record<PaymentStage, [string, string]> = {
    // [if the viewer pays, if the viewer is paid]
    free: ["", ""],
    open: [" · pay to secure the slot, or wait for them to ask", " · ask them to pay to secure the slot"],
    asked: [" · pay to secure the slot", " · waiting for them to pay"],
    cash_requested: [" · waiting for them to agree to cash", " · answer their cash request"],
    paid: [" · paid, waiting for them to confirm", " · confirm the payment you received"],
    confirmed: ["", ""],
    cash_agreed: [" · cash in person agreed, give it at the handover", " · cash in person agreed, you get it at the handover"],
    cash_given: [" · you gave the cash, waiting for them to confirm", " · confirm you received the cash"],
    cash_received: ["", ""],
  };
  const stage = paymentStage(d);
  let payment = secure[stage][pays ? 0 : 1];
  // The other way round when the one being paid is the one who asked for cash.
  if (stage === "cash_requested" && cashAskedBy(d) === "payee") payment = pays ? " · answer their cash request" : " · waiting for them to agree to cash";
  const mine = d.viewerIsOwner ? d.ownerConfirmedAt : d.responderConfirmedAt;
  const theirs = d.viewerIsOwner ? d.responderConfirmedAt : d.ownerConfirmedAt;
  const when = d.scheduledAt ? formatHandoverTime(d.scheduledAt) : "";
  // A new time proposed on an already scheduled reservation waits for an answer too.
  const proposal = d.proposedBy ? (d.proposedBy === d.viewerId ? " · waiting for them to answer your new time" : " · answer their new time") : "";
  if (mine) return `Scheduled ${when} · you confirmed, waiting for them${proposal}${payment}`;
  if (theirs) return `Scheduled ${when} · they confirmed, your turn${proposal}${payment}`;
  return `Scheduled ${when}${proposal}${payment}`;
}

const DEAL_CHIP: Partial<Record<TransactionGroup, string>> = { active: "Reserved", done: "Completed", cancelled: "Cancelled", reported: "Reported" };

/** `ongoing`: only what is still being carried out (offers waiting for an answer, reservations in progress). `conversationId`: only that conversation's. */
export type TransactionFilter = { ongoing?: boolean; conversationId?: string };

/**
 * All of a student's offers waiting for an answer, offers that ended in the last `ENDED_OFFER_DAYS` days, and
 * reservations (any state), most recently changed first. `filter` narrows it in the query, for the Messages list and thread.
 */
export async function listTransactions(viewerId: string, filter: TransactionFilter = {}): Promise<Transaction[]> {
  const db = getDb();
  const now = new Date();
  const since = new Date(now.getTime() - ENDED_OFFER_DAYS * 24 * 60 * 60 * 1000);
  const [deals, offers] = await Promise.all([
    db
      .select({
        id: deal.id,
        offerId: offer.id,
        postId: post.id,
        title: post.title,
        kind: post.kind,
        thumbKey: cover.thumbKey,
        ownerId: deal.ownerId,
        ownerName: owner.name,
        ownerHandle: owner.handle,
        responderName: responder.name,
        responderHandle: responder.handle,
        quantity: deal.quantity,
        amount: deal.amount,
        isReserve: offer.isReserve,
        status: deal.status,
        scheduledAt: deal.scheduledAt,
        proposedBy: deal.proposedBy,
        ownerConfirmedAt: deal.ownerConfirmedAt,
        responderConfirmedAt: deal.responderConfirmedAt,
        paidAt: deal.paidAt,
        paymentConfirmedAt: deal.paymentConfirmedAt,
        paymentAskedAt: deal.paymentAskedAt,
        cashRequestedAt: deal.cashRequestedAt,
        cashAgreedAt: deal.cashAgreedAt,
        cashGivenAt: deal.cashGivenAt,
        cashReceivedAt: deal.cashReceivedAt,
        postKind: post.kind,
        conversationId: offer.conversationId,
        at: deal.updatedAt,
      })
      .from(deal)
      .innerJoin(offer, eq(offer.id, deal.offerId))
      .innerJoin(post, eq(post.id, deal.postId))
      .innerJoin(owner, eq(owner.id, deal.ownerId))
      .innerJoin(responder, eq(responder.id, deal.responderId))
      .innerJoin(postPhoto, and(eq(postPhoto.postId, post.id), eq(postPhoto.position, 0)))
      .innerJoin(cover, eq(cover.id, postPhoto.imageId))
      .where(and(or(eq(deal.ownerId, viewerId), eq(deal.responderId, viewerId)), filter.ongoing ? inArray(deal.status, ["agreed", "scheduled"]) : undefined, filter.conversationId ? eq(offer.conversationId, filter.conversationId) : undefined))
      .orderBy(desc(deal.updatedAt)),
    db
      .select({
        id: offer.id,
        postId: post.id,
        title: post.title,
        kind: post.kind,
        thumbKey: cover.thumbKey,
        ownerId: post.ownerId,
        ownerName: owner.name,
        ownerHandle: owner.handle,
        responderName: responder.name,
        responderHandle: responder.handle,
        quantity: offer.quantity,
        amount: offer.amount,
        isReserve: offer.isReserve,
        status: offer.status,
        expiresAt: offer.expiresAt,
        decidedAt: offer.decidedAt,
        conversationId: offer.conversationId,
        createdAt: offer.createdAt,
      })
      .from(offer)
      .innerJoin(post, eq(post.id, offer.postId))
      .innerJoin(owner, eq(owner.id, post.ownerId))
      .innerJoin(responder, eq(responder.id, offer.responderId))
      .innerJoin(postPhoto, and(eq(postPhoto.postId, post.id), eq(postPhoto.position, 0)))
      .innerJoin(cover, eq(cover.id, postPhoto.imageId))
      .where(
        and(
          or(eq(post.ownerId, viewerId), eq(offer.responderId, viewerId)),
          filter.conversationId ? eq(offer.conversationId, filter.conversationId) : undefined,
          or(
            and(eq(offer.status, "pending"), gt(offer.expiresAt, now)),
            // Offers that came to nothing, for a while: a pending one past its time counts as expired before the sweep marks it.
            filter.ongoing ? undefined : and(gt(offer.createdAt, since), or(inArray(offer.status, ["declined", "withdrawn", "expired"]), and(eq(offer.status, "pending"), lte(offer.expiresAt, now)))),
          ),
        ),
      ),
  ]);

  const fromDeals = deals.map((d): Transaction => {
    const viewerIsOwner = d.ownerId === viewerId;
    const group: TransactionGroup = d.status === "completed" ? "done" : d.status === "cancelled" ? "cancelled" : d.status === "disputed" ? "reported" : "active";
    return {
      id: d.id,
      offerId: d.offerId,
      postId: d.postId,
      title: d.title,
      kind: d.kind,
      thumbKey: d.thumbKey,
      otherName: viewerIsOwner ? nameOf(d.responderName, d.responderHandle) : nameOf(d.ownerName, d.ownerHandle),
      otherHandle: (viewerIsOwner ? d.responderHandle : d.ownerHandle) ?? null,
      role: viewerIsOwner ? "selling" : "buying",
      quantity: d.quantity,
      amount: d.amount,
      isReserve: d.isReserve,
      group,
      turn: dealTurn({ ...d, viewerIsOwner, viewerId }, now),
      chip: DEAL_CHIP[group] ?? "",
      state: dealState({ ...d, viewerIsOwner, viewerId }),
      // Once payment is under way or a handover was confirmed, only completing or a report ends it (cancel.ts).
      action: group === "active" && !isSecured(d) ? "cancel" : null,
      conversationId: d.conversationId,
      at: d.at,
    };
  });

  const fromOffers = offers.map((o): Transaction => {
    const viewerIsOwner = o.ownerId === viewerId;
    const what = o.isReserve ? "reservation request" : "offer";
    const base = {
      id: o.id,
      offerId: o.id,
      postId: o.postId,
      title: o.title,
      kind: o.kind,
      thumbKey: o.thumbKey,
      otherName: viewerIsOwner ? nameOf(o.responderName, o.responderHandle) : nameOf(o.ownerName, o.ownerHandle),
      otherHandle: (viewerIsOwner ? o.responderHandle : o.ownerHandle) ?? null,
      role: viewerIsOwner ? ("selling" as const) : ("buying" as const),
      quantity: o.quantity,
      amount: o.amount,
      isReserve: o.isReserve,
      conversationId: o.conversationId,
    };
    if (o.status === "pending" && o.expiresAt.getTime() > now.getTime()) {
      return {
        ...base,
        group: "waiting",
        turn: offerTurn({ status: o.status, expiresAt: o.expiresAt, viewerIsOwner }, now),
        chip: "Waiting",
        state: viewerIsOwner ? (o.isReserve ? "Reservation request · waiting for you" : "Offer · waiting for you") : o.isReserve ? "Reservation request · waiting for the owner" : "Offer · waiting for the owner",
        action: viewerIsOwner ? "decline" : "withdraw",
        at: o.createdAt,
      };
    }
    // A pending offer past its time reads as expired, as the conversation does.
    const ended = o.status === "pending" ? "expired" : o.status;
    if (ended === "declined") {
      return { ...base, group: "ended", turn: "none", chip: "Declined", state: viewerIsOwner ? `You declined this ${what}` : `The owner declined your ${what}`, action: null, at: o.decidedAt ?? o.createdAt };
    }
    if (ended === "withdrawn") {
      return { ...base, group: "ended", turn: "none", chip: "Withdrawn", state: viewerIsOwner ? `They took back their ${what}` : `You took back your ${what}`, action: null, at: o.decidedAt ?? o.createdAt };
    }
    return { ...base, group: "ended", turn: "none", chip: "Expired", state: `No answer in time, so the ${what} ended`, action: null, at: o.decidedAt ?? o.expiresAt };
  });
  return [...fromOffers, ...fromDeals].sort((a, b) => b.at.getTime() - a.at.getTime());
}
