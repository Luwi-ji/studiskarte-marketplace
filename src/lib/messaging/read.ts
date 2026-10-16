import { and, count, desc, eq, gt, inArray, max, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { conversation, image, message, messageImage, offer, post, postPhoto, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { offerOptions, type OfferOptions } from "@/lib/deals/rules";
import { readOnlyReason } from "@/lib/messaging/rules";

/** Messages shown in a conversation: the latest this many. */
export const MESSAGES_SHOWN = 200;
const INBOX_MAX = 100;

export type Person = { handle: string | null; displayName: string; avatarThumbKey: string | null };

export type PostCard = {
  id: string;
  title: string;
  priceKind: string;
  priceAmount: number | null;
  status: string;
  thumbKey: string;
};

export type ConversationSummary = {
  id: string;
  other: Person;
  post: PostCard;
  lastMessage: { body: string | null; hasPictures: boolean; offer: { amount: number; isReserve: boolean } | null; fromMe: boolean; at: Date } | null;
  unread: number;
};

/** An offer as it stands now, shown as a card in the thread. */
export type OfferCard = {
  id: string;
  amount: number;
  isReserve: boolean;
  status: string;
  expiresAt: Date;
};

export type ChatMessage = {
  id: number;
  mine: boolean;
  body: string | null;
  createdAt: Date;
  pictures: { key: string; thumbKey: string; width: number; height: number }[];
  offer: OfferCard | null;
};

export type ConversationView = {
  id: string;
  other: Person;
  post: PostCard;
  messages: ChatMessage[];
  /** Null when the conversation takes new messages; otherwise why not. */
  readOnlyReason: string | null;
  unread: number;
  viewerIsOwner: boolean;
  postKind: string;
  /** What the viewer may do about the post: only meaningful for the responder, with no offer pending. */
  offerOptions: OfferOptions;
};

const owner = alias(student, "owner");
const responder = alias(student, "responder");
const ownerAvatar = alias(image, "owner_avatar");
const responderAvatar = alias(image, "responder_avatar");
const cover = alias(image, "cover");

/** The two people, post and state of conversations, as columns. Only participants are ever selected by callers. */
function conversationColumns() {
  return {
    id: conversation.id,
    responderId: conversation.responderId,
    ownerId: post.ownerId,
    ownerReadUpTo: conversation.ownerReadUpTo,
    responderReadUpTo: conversation.responderReadUpTo,
    postId: post.id,
    postTitle: post.title,
    postPriceKind: post.priceKind,
    postPriceAmount: post.priceAmount,
    postStatus: post.status,
    postExpiresAt: post.expiresAt,
    postKind: post.kind,
    thumbKey: cover.thumbKey,
    ownerHandle: owner.handle,
    ownerName: owner.name,
    ownerStatus: owner.accountStatus,
    ownerAvatarThumbKey: ownerAvatar.thumbKey,
    responderHandle: responder.handle,
    responderName: responder.name,
    responderStatus: responder.accountStatus,
    responderAvatarThumbKey: responderAvatar.thumbKey,
  };
}

function conversationQuery() {
  return getDb()
    .select(conversationColumns())
    .from(conversation)
    .innerJoin(post, eq(post.id, conversation.postId))
    .innerJoin(owner, eq(owner.id, post.ownerId))
    .innerJoin(responder, eq(responder.id, conversation.responderId))
    .innerJoin(postPhoto, and(eq(postPhoto.postId, post.id), eq(postPhoto.position, 0)))
    .innerJoin(cover, eq(cover.id, postPhoto.imageId))
    .leftJoin(ownerAvatar, eq(ownerAvatar.id, owner.avatarImageId))
    .leftJoin(responderAvatar, eq(responderAvatar.id, responder.avatarImageId));
}

/** One conversation as selected by conversationQuery. */
type Row = {
  id: string;
  responderId: string;
  ownerId: string;
  ownerReadUpTo: number;
  responderReadUpTo: number;
  postId: string;
  postTitle: string;
  postPriceKind: string;
  postPriceAmount: number | null;
  postStatus: string;
  postExpiresAt: Date;
  postKind: string;
  thumbKey: string;
  ownerHandle: string | null;
  ownerName: string;
  ownerStatus: string;
  ownerAvatarThumbKey: string | null;
  responderHandle: string | null;
  responderName: string;
  responderStatus: string;
  responderAvatarThumbKey: string | null;
};

function participantWhere(viewerId: string) {
  return or(eq(conversation.responderId, viewerId), eq(post.ownerId, viewerId));
}

function split(row: Row, viewerId: string): { other: Person; post: PostCard; readUpTo: number } {
  const viewerIsOwner = row.ownerId === viewerId;
  return {
    other: viewerIsOwner
      ? { handle: row.responderHandle, displayName: row.responderName, avatarThumbKey: row.responderAvatarThumbKey }
      : { handle: row.ownerHandle, displayName: row.ownerName, avatarThumbKey: row.ownerAvatarThumbKey },
    post: {
      id: row.postId,
      title: row.postTitle,
      priceKind: row.postPriceKind,
      priceAmount: row.postPriceAmount,
      status: row.postStatus,
      thumbKey: row.thumbKey,
    },
    readUpTo: viewerIsOwner ? row.ownerReadUpTo : row.responderReadUpTo,
  };
}

/** Messages from the other person that this viewer has not read, per conversation. */
async function unreadByConversation(viewerId: string, ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await getDb()
    .select({ id: message.conversationId, n: count() })
    .from(message)
    .innerJoin(conversation, eq(conversation.id, message.conversationId))
    .innerJoin(post, eq(post.id, conversation.postId))
    .where(
      and(
        inArray(message.conversationId, ids),
        ne(message.senderId, viewerId),
        or(
          and(eq(conversation.responderId, viewerId), gt(message.id, conversation.responderReadUpTo)),
          and(eq(post.ownerId, viewerId), gt(message.id, conversation.ownerReadUpTo)),
        ),
      ),
    )
    .groupBy(message.conversationId);
  return new Map(rows.map((row) => [row.id, row.n]));
}

/** The student's conversations, most recent message first, each with its last message and unread count. */
export async function listConversations(viewerId: string): Promise<ConversationSummary[]> {
  const rows = await conversationQuery().where(participantWhere(viewerId)).orderBy(desc(conversation.lastMessageAt)).limit(INBOX_MAX);
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);

  const [unread, lasts] = await Promise.all([
    unreadByConversation(viewerId, ids),
    getDb()
      .selectDistinctOn([message.conversationId], {
        conversationId: message.conversationId,
        senderId: message.senderId,
        body: message.body,
        createdAt: message.createdAt,
        hasPictures: sql<boolean>`exists (select 1 from ${messageImage} where ${messageImage.messageId} = ${message.id})`,
        offerAmount: offer.amount,
        offerIsReserve: offer.isReserve,
      })
      .from(message)
      .leftJoin(offer, eq(offer.id, message.offerId))
      .where(inArray(message.conversationId, ids))
      .orderBy(message.conversationId, desc(message.id)),
  ]);
  const lastById = new Map(lasts.map((last) => [last.conversationId, last]));

  return rows.map((row) => {
    const last = lastById.get(row.id);
    const { other, post: card } = split(row, viewerId);
    return {
      id: row.id,
      other,
      post: card,
      lastMessage: last
        ? {
            body: last.body,
            hasPictures: last.hasPictures,
            offer: last.offerAmount === null ? null : { amount: last.offerAmount, isReserve: last.offerIsReserve ?? false },
            fromMe: last.senderId === viewerId,
            at: last.createdAt,
          }
        : null,
      unread: unread.get(row.id) ?? 0,
    };
  });
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
    .select({ id: message.id, senderId: message.senderId, body: message.body, createdAt: message.createdAt, offerId: message.offerId })
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .orderBy(desc(message.id))
    .limit(MESSAGES_SHOWN);
  const ids = newest.map((m) => m.id);
  const pictures =
    ids.length === 0
      ? []
      : await getDb()
          .select({ messageId: messageImage.messageId, key: image.key, thumbKey: image.thumbKey, width: image.width, height: image.height })
          .from(messageImage)
          .innerJoin(image, eq(image.id, messageImage.imageId))
          .where(inArray(messageImage.messageId, ids))
          .orderBy(messageImage.messageId, messageImage.position);

  const offerIds = newest.flatMap((m) => (m.offerId ? [m.offerId] : []));
  const offers =
    offerIds.length === 0
      ? []
      : await getDb()
          .select({ id: offer.id, amount: offer.amount, isReserve: offer.isReserve, status: offer.status, expiresAt: offer.expiresAt })
          .from(offer)
          .where(inArray(offer.id, offerIds));
  const offerById = new Map(offers.map((o) => [o.id, o]));
  // A pending offer past its time is shown as expired even before the job has swept it.
  const now = Date.now();
  const shown = (o: OfferCard): OfferCard => (o.status === "pending" && o.expiresAt.getTime() <= now ? { ...o, status: "expired" } : o);
  const cardFor = (id: string | null): OfferCard | null => {
    const found = id ? offerById.get(id) : undefined;
    return found ? shown(found) : null;
  };
  const { other, post: card, readUpTo } = split(row, viewerId);
  return {
    id: row.id,
    other,
    post: card,
    messages: newest.reverse().map((m) => ({
      id: m.id,
      mine: m.senderId === viewerId,
      body: m.body,
      createdAt: m.createdAt,
      pictures: pictures.filter((p) => p.messageId === m.id).map((p) => ({ key: p.key, thumbKey: p.thumbKey, width: p.width, height: p.height })),
      offer: cardFor(m.offerId),
    })),
    readOnlyReason: readOnlyReason({
      postStatus: row.postStatus,
      postExpiresAt: row.postExpiresAt,
      ownerStatus: row.ownerStatus,
      responderStatus: row.responderStatus,
    }),
    unread: newest.filter((m) => m.senderId !== viewerId && m.id > readUpTo).length,
    viewerIsOwner: row.ownerId === viewerId,
    postKind: row.postKind,
    offerOptions: offerOptions({
      priceKind: row.postPriceKind,
      postStatus: row.postStatus,
      postExpiresAt: row.postExpiresAt,
      ownerStatus: row.ownerStatus,
      responderStatus: row.responderStatus,
    }),
  };
}

/** The viewer's existing conversation about a post, if they have one. */
export async function findConversationId(viewerId: string, postId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: conversation.id })
    .from(conversation)
    .where(and(eq(conversation.postId, postId), eq(conversation.responderId, viewerId)));
  return row?.id ?? null;
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
    const asResponder = await tx
      .update(conversation)
      .set({ responderReadUpTo: upTo })
      .where(and(eq(conversation.id, conversationId), eq(conversation.responderId, viewerId), sql`${conversation.responderReadUpTo} < ${upTo}`))
      .returning({ id: conversation.id });
    const asOwner = await tx
      .update(conversation)
      .set({ ownerReadUpTo: upTo })
      .where(
        and(
          eq(conversation.id, conversationId),
          sql`${conversation.ownerReadUpTo} < ${upTo}`,
          sql`exists (select 1 from ${post} where ${post.id} = ${conversation.postId} and ${post.ownerId} = ${viewerId})`,
        ),
      )
      .returning({ id: conversation.id });
    return asResponder.length + asOwner.length > 0;
  });
}

/** Messages from other people the viewer has not read, across all conversations (the badge on Messages). */
export async function countUnread(viewerId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(message)
    .innerJoin(conversation, eq(conversation.id, message.conversationId))
    .innerJoin(post, eq(post.id, conversation.postId))
    .where(
      and(
        ne(message.senderId, viewerId),
        or(
          and(eq(conversation.responderId, viewerId), gt(message.id, conversation.responderReadUpTo)),
          and(eq(post.ownerId, viewerId), gt(message.id, conversation.ownerReadUpTo)),
        ),
      ),
    );
  return row.n;
}
