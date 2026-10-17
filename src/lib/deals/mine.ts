import { and, desc, eq, gt, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { deal, image, offer, post, postPhoto, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { formatHandoverTime } from "@/lib/deals/handover";

/** Where a transaction is: what is waiting on someone, being carried out, or over. */
export type TransactionGroup = "waiting" | "active" | "done" | "closed";

export type Transaction = {
  /** The deal's id, or the offer's while it is only an offer. */
  id: string;
  postId: string;
  title: string;
  thumbKey: string;
  otherName: string;
  /** The viewer is buying (made the offer) or selling (owns the listing). */
  role: "buying" | "selling";
  quantity: number;
  /** Per unit. */
  amount: number;
  isReserve: boolean;
  group: TransactionGroup;
  /** One line on where it stands and what comes next. */
  state: string;
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
function dealState(d: {
  status: string;
  scheduledAt: Date | null;
  proposedBy: string | null;
  ownerConfirmedAt: Date | null;
  responderConfirmedAt: Date | null;
  amount: number;
  paidAt: Date | null;
  paymentConfirmedAt: Date | null;
  postKind: string;
  viewerIsOwner: boolean;
  viewerId: string;
}): string {
  // Payment, when there is something to pay: what the viewer or the other still has to do.
  const viewerPays = d.postKind === "wishlist" ? d.viewerIsOwner : !d.viewerIsOwner;
  const payment =
    d.amount === 0 || d.paymentConfirmedAt
      ? ""
      : !d.paidAt
        ? viewerPays
          ? " · you still need to pay"
          : " · waiting for them to pay"
        : viewerPays
          ? " · payment waiting for them to confirm"
          : " · confirm the payment you received";
  if (d.status === "completed") return "Completed";
  if (d.status === "cancelled") return "Cancelled";
  if (d.status === "agreed") {
    if (!d.proposedBy) return `Reserved · agree a time and place${payment}`;
    return `${d.proposedBy === d.viewerId ? "Reserved · waiting for them to answer your time" : "Reserved · answer their proposed time"}${payment}`;
  }
  const mine = d.viewerIsOwner ? d.ownerConfirmedAt : d.responderConfirmedAt;
  const theirs = d.viewerIsOwner ? d.responderConfirmedAt : d.ownerConfirmedAt;
  const when = d.scheduledAt ? formatHandoverTime(d.scheduledAt) : "";
  if (mine) return `Scheduled ${when} · you confirmed, waiting for them${payment}`;
  if (theirs) return `Scheduled ${when} · they confirmed, your turn${payment}`;
  return `Scheduled ${when}${payment}`;
}

/** All of a student's offers waiting for an answer, and reservations (any state), most recently changed first. */
export async function listTransactions(viewerId: string): Promise<Transaction[]> {
  const db = getDb();
  const [deals, offers] = await Promise.all([
    db
      .select({
        id: deal.id,
        postId: post.id,
        title: post.title,
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
      .where(or(eq(deal.ownerId, viewerId), eq(deal.responderId, viewerId)))
      .orderBy(desc(deal.updatedAt)),
    db
      .select({
        id: offer.id,
        postId: post.id,
        title: post.title,
        thumbKey: cover.thumbKey,
        ownerId: post.ownerId,
        ownerName: owner.name,
        ownerHandle: owner.handle,
        responderName: responder.name,
        responderHandle: responder.handle,
        quantity: offer.quantity,
        amount: offer.amount,
        isReserve: offer.isReserve,
        conversationId: offer.conversationId,
        at: offer.createdAt,
      })
      .from(offer)
      .innerJoin(post, eq(post.id, offer.postId))
      .innerJoin(owner, eq(owner.id, post.ownerId))
      .innerJoin(responder, eq(responder.id, offer.responderId))
      .innerJoin(postPhoto, and(eq(postPhoto.postId, post.id), eq(postPhoto.position, 0)))
      .innerJoin(cover, eq(cover.id, postPhoto.imageId))
      .where(and(eq(offer.status, "pending"), gt(offer.expiresAt, new Date()), or(eq(post.ownerId, viewerId), eq(offer.responderId, viewerId)))),
  ]);

  const fromDeals = deals.map((d): Transaction => {
    const viewerIsOwner = d.ownerId === viewerId;
    return {
      id: d.id,
      postId: d.postId,
      title: d.title,
      thumbKey: d.thumbKey,
      otherName: viewerIsOwner ? nameOf(d.responderName, d.responderHandle) : nameOf(d.ownerName, d.ownerHandle),
      role: viewerIsOwner ? "selling" : "buying",
      quantity: d.quantity,
      amount: d.amount,
      isReserve: d.isReserve,
      group: d.status === "completed" ? "done" : d.status === "cancelled" ? "closed" : "active",
      state: dealState({ ...d, viewerIsOwner, viewerId }),
      conversationId: d.conversationId,
      at: d.at,
    };
  });
  const fromOffers = offers.map((o): Transaction => {
    const viewerIsOwner = o.ownerId === viewerId;
    return {
      id: o.id,
      postId: o.postId,
      title: o.title,
      thumbKey: o.thumbKey,
      otherName: viewerIsOwner ? nameOf(o.responderName, o.responderHandle) : nameOf(o.ownerName, o.ownerHandle),
      role: viewerIsOwner ? "selling" : "buying",
      quantity: o.quantity,
      amount: o.amount,
      isReserve: o.isReserve,
      group: "waiting",
      state: viewerIsOwner ? (o.isReserve ? "Reservation request · waiting for you" : "Offer · waiting for you") : o.isReserve ? "Reservation request · waiting for the owner" : "Offer · waiting for the owner",
      conversationId: o.conversationId,
      at: o.at,
    };
  });
  return [...fromOffers, ...fromDeals];
}
