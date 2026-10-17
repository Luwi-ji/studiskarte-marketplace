import { and, count, desc, eq, gt, inArray, max, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { conversation, conversationListing, deal, dealReport, image, message, messageImage, offer, post, postPhoto, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { transactionLabel } from "@/lib/deals/rules";
import { loadAvailability } from "@/lib/posts/availability";
import type { Availability } from "@/lib/posts/schema";
import { asMethod, type HandoverMethod } from "@/lib/deals/handover";
import { readOnlyReason } from "@/lib/messaging/rules";
import { paymentModesOf, type PaymentMode } from "@/lib/payment";
import { canReport, isSecured, paymentStage, REPORT_REASONS, type PaymentStage, type ReportReason } from "@/lib/deals/slot";

/** Messages shown in a conversation: the latest this many. */
export const MESSAGES_SHOWN = 200;
const INBOX_MAX = 100;

export type Person = { handle: string | null; displayName: string; avatarThumbKey: string | null };

/** A listing as shown in a thread: on a card, in an offer, in the Transactions list. */
export type PostCard = {
  id: string;
  title: string;
  priceKind: string;
  priceAmount: number | null;
  status: string;
  thumbKey: string;
  kind: string;
};

/** A listing in a thread, from the viewer's side. */
export type ThreadListing = {
  post: PostCard;
  /** The listing is the viewer's own. */
  viewerIsOwner: boolean;
  /** Where the offer or reservation on it stands, if there is one. */
  state: string | null;
};

export type ConversationSummary = {
  id: string;
  other: Person;
  /** How many listings (transactions) the two have dealt about. */
  listingCount: number;
  /** The listing's title when there is just one; null otherwise. */
  listingTitle: string | null;
  lastMessage: { body: string | null; hasPictures: boolean; offer: { amount: number; quantity: number; isReserve: boolean } | null; fromMe: boolean; at: Date } | null;
  unread: number;
};

/** A reservation as the viewer sees it: the agreed handover, a proposal waiting for an answer, who has confirmed. */
export type DealCard = {
  id: string;
  status: string;
  handover: { method: HandoverMethod; at: Date; place: string } | null;
  proposal: { byMe: boolean; method: HandoverMethod; at: Date; place: string } | null;
  confirmedByMe: boolean;
  confirmedByOther: boolean;
  /** The viewer is the one handing it over (on a Wishlist, the one who supplies it, not the one who posted it). */
  viewerHandsOver: boolean;
  /** Paying for it, from the viewer's side. Null when there is nothing to pay (a free deal). */
  payment: {
    /** The viewer is the one paying (on a Wishlist, the one who posted it). */
    viewerPays: boolean;
    modes: PaymentMode[];
    /** Where to pay online, or what "others" means. */
    note: string | null;
    /** The total: the price each times the units. */
    total: number;
    stage: PaymentStage;
    /** The online or other way the payer was asked to pay by. */
    askMethod: PaymentMode | null;
    /** The way it was paid, once paid. */
    method: PaymentMode | null;
  } | null;
  /** Paid, or cash in person agreed: it can no longer be cancelled. */
  secured: boolean;
  /** A problem can be reported now. */
  canReport: boolean;
  /** What each side said went wrong, once reported. */
  reports: { mine: boolean; blames: "me" | "them" | null; reason: ReportReason; details: string | null }[];
  /** For proposing: what the post offers, where it says to meet or deliver, and when it is available. Only while the reservation is active. */
  options: { methods: HandoverMethod[]; meetupPlace: string | null; deliveryPlace: string | null; windows: Availability[] } | null;
};

/** An offer as it stands now, shown as a card in the thread. */
export type OfferCard = {
  id: string;
  /** Per unit. */
  amount: number;
  quantity: number;
  isReserve: boolean;
  status: string;
  expiresAt: Date;
  /** The reservation made from this offer when it was accepted, with its own state. */
  deal: DealCard | null;
  /** The listing it is on. */
  post: PostCard;
  /** The viewer owns that listing, so the offer is theirs to decide. */
  viewerIsOwner: boolean;
};

export type ChatMessage = {
  id: number;
  mine: boolean;
  body: string | null;
  createdAt: Date;
  pictures: { key: string; thumbKey: string; width: number; height: number }[];
  /** Set on a message sent about a listing (an offer card shows its own). */
  listing: ThreadListing | null;
  offer: OfferCard | null;
};

export type ConversationView = {
  id: string;
  other: Person;
  messages: ChatMessage[];
  /** Every listing the two have dealt about, the one with the newest message first. */
  listings: ThreadListing[];
  /** Null when the conversation takes new messages; otherwise why not. */
  readOnlyReason: string | null;
  unread: number;
};

const personA = alias(student, "person_a");
const personB = alias(student, "person_b");
const avatarA = alias(image, "avatar_a");
const avatarB = alias(image, "avatar_b");
const cover = alias(image, "cover");

type Row = {
  id: string;
  aId: string;
  bId: string;
  aReadUpTo: number;
  bReadUpTo: number;
  aHandle: string | null;
  aName: string;
  aStatus: string;
  aAvatarThumbKey: string | null;
  bHandle: string | null;
  bName: string;
  bStatus: string;
  bAvatarThumbKey: string | null;
};

/** The two people of conversations, as columns. Only participants are ever selected by callers. */
function conversationQuery() {
  return getDb()
    .select({
      id: conversation.id,
      aId: conversation.participantA,
      bId: conversation.participantB,
      aReadUpTo: conversation.aReadUpTo,
      bReadUpTo: conversation.bReadUpTo,
      aHandle: personA.handle,
      aName: personA.name,
      aStatus: personA.accountStatus,
      aAvatarThumbKey: avatarA.thumbKey,
      bHandle: personB.handle,
      bName: personB.name,
      bStatus: personB.accountStatus,
      bAvatarThumbKey: avatarB.thumbKey,
    })
    .from(conversation)
    .innerJoin(personA, eq(personA.id, conversation.participantA))
    .innerJoin(personB, eq(personB.id, conversation.participantB))
    .leftJoin(avatarA, eq(avatarA.id, personA.avatarImageId))
    .leftJoin(avatarB, eq(avatarB.id, personB.avatarImageId));
}

function participantWhere(viewerId: string) {
  return or(eq(conversation.participantA, viewerId), eq(conversation.participantB, viewerId));
}

/** The other person, and how far the viewer has read. */
function split(row: Row, viewerId: string): { other: Person; readUpTo: number } {
  const viewerIsA = row.aId === viewerId;
  return {
    other: viewerIsA
      ? { handle: row.bHandle, displayName: row.bName, avatarThumbKey: row.bAvatarThumbKey }
      : { handle: row.aHandle, displayName: row.aName, avatarThumbKey: row.aAvatarThumbKey },
    readUpTo: viewerIsA ? row.aReadUpTo : row.bReadUpTo,
  };
}

/** How far the viewer has read, as SQL, for a query over conversation. */
function readUpToSql(viewerId: string) {
  return sql<number>`case when ${conversation.participantA} = ${viewerId} then ${conversation.aReadUpTo} else ${conversation.bReadUpTo} end`;
}

/** Messages from the other person that this viewer has not read, per conversation. */
async function unreadByConversation(viewerId: string, ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await getDb()
    .select({ id: message.conversationId, n: count() })
    .from(message)
    .innerJoin(conversation, eq(conversation.id, message.conversationId))
    .where(and(inArray(message.conversationId, ids), ne(message.senderId, viewerId), participantWhere(viewerId), gt(message.id, readUpToSql(viewerId))))
    .groupBy(message.conversationId);
  return new Map(rows.map((row) => [row.id, row.n]));
}

/** The student's conversations, most recent message first, each with its last message and unread count. */
export async function listConversations(viewerId: string): Promise<ConversationSummary[]> {
  const rows = await conversationQuery().where(participantWhere(viewerId)).orderBy(desc(conversation.lastMessageAt)).limit(INBOX_MAX);
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);

  const [unread, lasts, listings] = await Promise.all([
    unreadByConversation(viewerId, ids),
    getDb()
      .selectDistinctOn([message.conversationId], {
        conversationId: message.conversationId,
        senderId: message.senderId,
        body: message.body,
        createdAt: message.createdAt,
        hasPictures: sql<boolean>`exists (select 1 from ${messageImage} where ${messageImage.messageId} = ${message.id})`,
        offerAmount: offer.amount,
        offerQuantity: offer.quantity,
        offerIsReserve: offer.isReserve,
      })
      .from(message)
      .leftJoin(offer, eq(offer.id, message.offerId))
      .where(inArray(message.conversationId, ids))
      .orderBy(message.conversationId, desc(message.id)),
    getDb()
      .select({ conversationId: conversationListing.conversationId, title: post.title })
      .from(conversationListing)
      .innerJoin(post, eq(post.id, conversationListing.postId))
      .where(inArray(conversationListing.conversationId, ids)),
  ]);
  const lastById = new Map(lasts.map((last) => [last.conversationId, last]));
  const titlesById = new Map<string, string[]>();
  for (const l of listings) titlesById.set(l.conversationId, [...(titlesById.get(l.conversationId) ?? []), l.title]);

  return rows.map((row) => {
    const last = lastById.get(row.id);
    const titles = titlesById.get(row.id) ?? [];
    return {
      id: row.id,
      other: split(row, viewerId).other,
      listingCount: titles.length,
      listingTitle: titles.length === 1 ? titles[0] : null,
      lastMessage: last
        ? {
            body: last.body,
            hasPictures: last.hasPictures,
            offer: last.offerAmount === null ? null : { amount: last.offerAmount, quantity: last.offerQuantity ?? 1, isReserve: last.offerIsReserve ?? false },
            fromMe: last.senderId === viewerId,
            at: last.createdAt,
          }
        : null,
      unread: unread.get(row.id) ?? 0,
    };
  });
}

/** The listings a thread is about, the one with the newest message first, as cards. */
async function threadListings(viewerId: string, conversationId: string): Promise<ThreadListing[]> {
  const newestMessage = sql`(select max(${message.id}) from ${message} where ${message.conversationId} = ${conversationId} and ${message.postId} = ${post.id})`;
  const rows = await getDb()
    .select({
      id: post.id,
      title: post.title,
      priceKind: post.priceKind,
      priceAmount: post.priceAmount,
      status: post.status,
      kind: post.kind,
      ownerId: post.ownerId,
      thumbKey: cover.thumbKey,
    })
    .from(conversationListing)
    .innerJoin(post, eq(post.id, conversationListing.postId))
    .innerJoin(postPhoto, and(eq(postPhoto.postId, post.id), eq(postPhoto.position, 0)))
    .innerJoin(cover, eq(cover.id, postPhoto.imageId))
    .where(eq(conversationListing.conversationId, conversationId))
    .orderBy(sql`${newestMessage} desc nulls last`, desc(conversationListing.createdAt));
  if (rows.length === 0) return [];

  // The latest offer on each listing in this thread: the state of that transaction.
  const offers = await getDb()
    .selectDistinctOn([offer.postId], {
      postId: offer.postId,
      isReserve: offer.isReserve,
      status: offer.status,
      expiresAt: offer.expiresAt,
      dealStatus: deal.status,
    })
    .from(offer)
    .leftJoin(deal, eq(deal.offerId, offer.id))
    .where(eq(offer.conversationId, conversationId))
    .orderBy(offer.postId, desc(offer.createdAt));
  const offerByPost = new Map(offers.map((o) => [o.postId, o]));
  return rows.map((row) => ({
    viewerIsOwner: row.ownerId === viewerId,
    state: transactionLabel(offerByPost.get(row.id) ?? null),
    post: { id: row.id, title: row.title, priceKind: row.priceKind, priceAmount: row.priceAmount, status: row.status, thumbKey: row.thumbKey, kind: row.kind },
  }));
}

type DealRow = {
  dealId: string | null;
  dealStatus: string | null;
  handoverMethod: string | null;
  scheduledAt: Date | null;
  place: string | null;
  proposedBy: string | null;
  proposedMethod: string | null;
  proposedAt: Date | null;
  proposedPlace: string | null;
  ownerConfirmedAt: Date | null;
  responderConfirmedAt: Date | null;
  exchangeMeetup: boolean;
  exchangeDelivery: boolean;
  meetupLocation: string | null;
  deliveryArea: string | null;
  postKind: string;
  paymentCash: boolean;
  paymentOnline: boolean;
  paymentOther: boolean;
  paymentNote: string | null;
  dealAmount: number | null;
  dealQuantity: number | null;
  paymentMethod: string | null;
  paidAt: Date | null;
  paymentConfirmedAt: Date | null;
  paymentAskedAt: Date | null;
  paymentAskMethod: string | null;
  cashRequestedAt: Date | null;
  cashAgreedAt: Date | null;
};

const asMode = (value: string | null): PaymentMode | null => (value === "online" || value === "other" || value === "cash" ? value : null);
const asReason = (value: string): ReportReason => (value in REPORT_REASONS ? (value as ReportReason) : "other");

type ReportRow = { dealId: string; reporterId: string; faultPartyId: string | null; reason: string; details: string | null };

function dealCard(o: DealRow, viewerIsOwner: boolean, viewerId: string, windows: Availability[] | undefined, reports: ReportRow[]): DealCard | null {
  if (!o.dealId || !o.dealStatus) return null;
  const fields = { amount: o.dealAmount ?? 0, paymentAskedAt: o.paymentAskedAt, cashRequestedAt: o.cashRequestedAt, cashAgreedAt: o.cashAgreedAt, paidAt: o.paidAt, paymentConfirmedAt: o.paymentConfirmedAt };
  const stage = paymentStage(fields);
  const mine = viewerIsOwner ? o.ownerConfirmedAt : o.responderConfirmedAt;
  const theirs = viewerIsOwner ? o.responderConfirmedAt : o.ownerConfirmedAt;
  return {
    id: o.dealId,
    status: o.dealStatus,
    handover: o.handoverMethod && o.scheduledAt && o.place ? { method: asMethod(o.handoverMethod), at: o.scheduledAt, place: o.place } : null,
    proposal:
      o.proposedBy && o.proposedMethod && o.proposedAt && o.proposedPlace
        ? { byMe: o.proposedBy === viewerId, method: asMethod(o.proposedMethod), at: o.proposedAt, place: o.proposedPlace }
        : null,
    payment:
      o.dealAmount === null || o.dealQuantity === null || o.dealAmount === 0
        ? null
        : {
            viewerPays: o.postKind === "wishlist" ? viewerIsOwner : !viewerIsOwner,
            modes: paymentModesOf(o),
            note: o.paymentNote,
            total: o.dealAmount * o.dealQuantity,
            stage: stage,
            askMethod: asMode(o.paymentAskMethod),
            method: asMode(o.paymentMethod),
          },
    secured: isSecured(fields),
    canReport: canReport({ ...fields, status: o.dealStatus, scheduledAt: o.scheduledAt }) || (o.dealStatus === "disputed" && !reports.some((r) => r.reporterId === viewerId)),
    reports: reports.map((r) => ({ mine: r.reporterId === viewerId, blames: r.faultPartyId === null ? null : r.faultPartyId === viewerId ? "me" : "them", reason: asReason(r.reason), details: r.details })),
    confirmedByMe: mine !== null,
    confirmedByOther: theirs !== null,
    viewerHandsOver: o.postKind === "wishlist" ? !viewerIsOwner : viewerIsOwner,
    options: windows
      ? {
          methods: [...(o.exchangeMeetup ? (["meetup"] as const) : []), ...(o.exchangeDelivery ? (["delivery"] as const) : [])],
          meetupPlace: o.meetupLocation,
          deliveryPlace: o.deliveryArea,
          windows,
        }
      : null,
  };
}

/**
 * One conversation with its latest messages, or null unless the viewer is one
 * of its two participants. Picture keys are only ever returned here, so only a
 * participant can be given a link to a picture.
 */
export async function getConversation(viewerId: string, conversationId: string): Promise<ConversationView | null> {
  const [row] = await conversationQuery().where(and(eq(conversation.id, conversationId), participantWhere(viewerId)));
  if (!row) return null;

  const newest = await getDb()
    .select({ id: message.id, senderId: message.senderId, body: message.body, createdAt: message.createdAt, offerId: message.offerId, postId: message.postId })
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .orderBy(desc(message.id))
    .limit(MESSAGES_SHOWN);
  const ids = newest.map((m) => m.id);
  const [pictures, listings] = await Promise.all([
    ids.length === 0
      ? []
      : getDb()
          .select({ messageId: messageImage.messageId, key: image.key, thumbKey: image.thumbKey, width: image.width, height: image.height })
          .from(messageImage)
          .innerJoin(image, eq(image.id, messageImage.imageId))
          .where(inArray(messageImage.messageId, ids))
          .orderBy(messageImage.messageId, messageImage.position),
    threadListings(viewerId, conversationId),
  ]);
  const listingById = new Map(listings.map((l) => [l.post.id, l]));

  const offerIds = newest.flatMap((m) => (m.offerId ? [m.offerId] : []));
  const offers =
    offerIds.length === 0
      ? []
      : await getDb()
          .select({
            id: offer.id,
            postId: offer.postId,
            amount: offer.amount,
            quantity: offer.quantity,
            isReserve: offer.isReserve,
            status: offer.status,
            expiresAt: offer.expiresAt,
            dealId: deal.id,
            dealStatus: deal.status,
            handoverMethod: deal.handoverMethod,
            scheduledAt: deal.scheduledAt,
            place: deal.place,
            proposedBy: deal.proposedBy,
            proposedMethod: deal.proposedMethod,
            proposedAt: deal.proposedAt,
            proposedPlace: deal.proposedPlace,
            ownerConfirmedAt: deal.ownerConfirmedAt,
            responderConfirmedAt: deal.responderConfirmedAt,
            exchangeMeetup: post.exchangeMeetup,
            exchangeDelivery: post.exchangeDelivery,
            meetupLocation: post.meetupLocation,
            deliveryArea: post.deliveryArea,
            postKind: post.kind,
            paymentCash: post.paymentCash,
            paymentOnline: post.paymentOnline,
            paymentOther: post.paymentOther,
            paymentNote: post.paymentNote,
            dealAmount: deal.amount,
            dealQuantity: deal.quantity,
            paymentMethod: deal.paymentMethod,
            paidAt: deal.paidAt,
            paymentConfirmedAt: deal.paymentConfirmedAt,
            paymentAskedAt: deal.paymentAskedAt,
            paymentAskMethod: deal.paymentAskMethod,
            cashRequestedAt: deal.cashRequestedAt,
            cashAgreedAt: deal.cashAgreedAt,
          })
          .from(offer)
          .innerJoin(post, eq(post.id, offer.postId))
          .leftJoin(deal, eq(deal.offerId, offer.id))
          .where(inArray(offer.id, offerIds));
  // Only reservations still being carried out can be rescheduled, so only they need the post's availability.
  const activePostIds = [...new Set(offers.filter((o) => o.dealStatus === "agreed" || o.dealStatus === "scheduled").map((o) => o.postId))];
  const disputedIds = offers.flatMap((o) => (o.dealStatus === "disputed" && o.dealId ? [o.dealId] : []));
  const reportRows: ReportRow[] =
    disputedIds.length === 0
      ? []
      : await getDb()
          .select({ dealId: dealReport.dealId, reporterId: dealReport.reporterId, faultPartyId: dealReport.faultPartyId, reason: dealReport.reason, details: dealReport.details })
          .from(dealReport)
          .where(inArray(dealReport.dealId, disputedIds))
          .orderBy(dealReport.createdAt);
  const reportsByDeal = new Map<string, ReportRow[]>();
  for (const r of reportRows) reportsByDeal.set(r.dealId, [...(reportsByDeal.get(r.dealId) ?? []), r]);
  const windowsByPost = new Map(await Promise.all(activePostIds.map(async (id): Promise<[string, Availability[]]> => [id, await loadAvailability(id)])));
  // A pending offer past its time is shown as expired even before the job has swept it.
  const now = Date.now();
  const offerById = new Map<string, OfferCard>();
  for (const o of offers) {
    const listing = listingById.get(o.postId);
    if (!listing) continue;
    offerById.set(o.id, {
      id: o.id,
      amount: o.amount,
      quantity: o.quantity,
      isReserve: o.isReserve,
      status: o.status === "pending" && o.expiresAt.getTime() <= now ? "expired" : o.status,
      expiresAt: o.expiresAt,
      deal: o.dealId && o.dealStatus ? dealCard(o, listing.viewerIsOwner, viewerId, windowsByPost.get(o.postId), reportsByDeal.get(o.dealId) ?? []) : null,
      post: listing.post,
      viewerIsOwner: listing.viewerIsOwner,
    });
  }

  const { other, readUpTo } = split(row, viewerId);
  return {
    id: row.id,
    other,
    messages: newest.reverse().map((m) => {
      const listing = !m.offerId && m.postId ? listingById.get(m.postId) : undefined;
      return {
        id: m.id,
        mine: m.senderId === viewerId,
        body: m.body,
        createdAt: m.createdAt,
        pictures: pictures.filter((p) => p.messageId === m.id).map((p) => ({ key: p.key, thumbKey: p.thumbKey, width: p.width, height: p.height })),
        listing: listing ?? null,
        offer: (m.offerId && offerById.get(m.offerId)) || null,
      };
    }),
    listings,
    readOnlyReason: readOnlyReason({ aStatus: row.aStatus, bStatus: row.bStatus }),
    unread: newest.filter((m) => m.senderId !== viewerId && m.id > readUpTo).length,
  };
}

/**
 * Marks everything in the conversation as read for the viewer. Does nothing
 * for a stranger. Returns whether anything was unread.
 */
export async function markRead(viewerId: string, conversationId: string): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    const [latest] = await tx.select({ id: max(message.id) }).from(message).where(eq(message.conversationId, conversationId));
    const upTo = latest?.id ?? 0;
    if (upTo === 0) return false;
    const asA = await tx
      .update(conversation)
      .set({ aReadUpTo: upTo })
      .where(and(eq(conversation.id, conversationId), eq(conversation.participantA, viewerId), sql`${conversation.aReadUpTo} < ${upTo}`))
      .returning({ id: conversation.id });
    const asB = await tx
      .update(conversation)
      .set({ bReadUpTo: upTo })
      .where(and(eq(conversation.id, conversationId), eq(conversation.participantB, viewerId), sql`${conversation.bReadUpTo} < ${upTo}`))
      .returning({ id: conversation.id });
    return asA.length + asB.length > 0;
  });
}

/** Messages from other people the viewer has not read, across all conversations (the badge on Messages). */
export async function countUnread(viewerId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(message)
    .innerJoin(conversation, eq(conversation.id, message.conversationId))
    .where(and(ne(message.senderId, viewerId), participantWhere(viewerId), gt(message.id, readUpToSql(viewerId))));
  return row.n;
}
