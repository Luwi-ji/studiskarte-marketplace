import { and, count, eq, gt, inArray, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { deal, offer, post, student } from "@/db/schema";
import { getDb, type DbTransaction } from "@/lib/db";
import { isUniqueViolation, getOrCreateConversation, writeMessage } from "@/lib/messaging/send";
import { MESSAGES_PER_MINUTE } from "@/lib/messaging/rules";
import { offerKey, recordNotification, type AlertSink, type Recorded } from "@/lib/notifications/record";
import { consume } from "@/lib/rate-limit";
import { ACTIVE_STATUSES, unitsLeft, unitsTaken } from "@/lib/deals/capacity";
import { OFFER_DAYS, offerOptions, parseOffer, PENDING_OFFER } from "@/lib/deals/rules";

export type OfferResult =
  | { ok: true; conversationId: string; offerId: string }
  | { ok: false; error: string; /** The form field the error is about, when there is one. */ field?: "amount" | "quantity" | "note" };
export type DecisionResult = { ok: true; conversationId: string } | { ok: false; error: string };

export const OFFER_NOT_FOUND = "That offer could not be found.";
export const OFFER_CLOSED = "This offer is no longer open.";
/** The buyer has an offer here that is waiting and not yet out of time. */
async function hasPendingOfferIn(tx: DbTransaction, postId: string, responderId: string, now: Date): Promise<boolean> {
  const [row] = await tx
    .select({ n: count() })
    .from(offer)
    .where(and(eq(offer.postId, postId), eq(offer.responderId, responderId), eq(offer.status, "pending"), gt(offer.expiresAt, now)));
  return row.n > 0;
}

const TOO_FAST = "You are sending messages too fast. Wait a moment and try again.";

/**
 * The responder makes an offer on a post, or reserves it at the asking price.
 * The offer appears as a card in the one conversation between the two of
 * them, which is created if this is their first contact, and the post joins
 * its listings. Refused for your own post, for a
 * post that is reserved, closed, expired or hidden, for a "reserve" of a
 * negotiable post, and for an offer on a free one. One pending offer per post.
 */
export async function makeOffer(args: {
  responderId: string;
  postId: string;
  input: unknown;
  alert?: AlertSink;
  now?: Date;
}): Promise<OfferResult> {
  const parsed = parseOffer(args.input);
  if (!parsed.ok) return parsed;
  const data = parsed.data;
  if (!(await consume({ action: "message", key: args.responderId, max: MESSAGES_PER_MINUTE, windowSeconds: 60 }))) {
    return { ok: false, error: TOO_FAST };
  }
  const now = args.now ?? new Date();
  const owner = alias(student, "owner");
  let recorded = null as Recorded | null;

  try {
    const result = await getDb().transaction(async (tx): Promise<OfferResult> => {
      // Share-lock the post: it cannot be reserved, withdrawn or expired between this check and the write.
      const [target] = await tx
        .select({
          ownerId: post.ownerId,
          status: post.status,
          expiresAt: post.expiresAt,
          priceKind: post.priceKind,
          priceAmount: post.priceAmount,
          quantity: post.quantity,
          ownerStatus: owner.accountStatus,
        })
        .from(post)
        .innerJoin(owner, eq(owner.id, post.ownerId))
        .where(eq(post.id, args.postId))
        .for("share", { of: post });
      const [me] = await tx.select({ status: student.accountStatus }).from(student).where(eq(student.id, args.responderId));
      if (!target || !me) return { ok: false, error: "That post could not be found." };
      if (target.ownerId === args.responderId) return { ok: false, error: "You can't make an offer on your own post." };

      const [mine] = await tx
        .select({ n: count() })
        .from(deal)
        .where(and(eq(deal.postId, args.postId), eq(deal.responderId, args.responderId), inArray(deal.status, [...ACTIVE_STATUSES])));
      const options = offerOptions({
        unitsLeft: unitsLeft(target.quantity, await unitsTaken(tx, args.postId)),
        hasActiveDeal: mine.n > 0,
        hasPendingOffer: await hasPendingOfferIn(tx, args.postId, args.responderId, now),
        priceKind: target.priceKind,
        postStatus: target.status,
        postExpiresAt: target.expiresAt,
        ownerStatus: target.ownerStatus,
        responderStatus: me.status,
        now,
      });
      if (!options.offer && !options.reserve) return { ok: false, error: options.reason ?? "This post takes no offers." };
      if (data.kind === "reserve" && !options.reserve) return { ok: false, error: "This post has no price to reserve at. Make an offer instead." };
      if (data.kind === "offer" && !options.offer) return { ok: false, error: "This post is free. Reserve it instead." };

      if (data.quantity > options.maxQuantity) {
        return { ok: false, error: options.maxQuantity === 1 ? "Only 1 is left." : `Only ${options.maxQuantity} left.`, field: "quantity" };
      }

      const conversationId = await getOrCreateConversation(tx, { postId: args.postId, ownerId: target.ownerId, otherId: args.responderId });
      // An offer whose time has run out must not block a new one while the job has not yet swept it.
      await tx
        .update(offer)
        .set({ status: "expired", decidedAt: now })
        .where(and(eq(offer.postId, args.postId), eq(offer.responderId, args.responderId), eq(offer.status, "pending"), lte(offer.expiresAt, now)));

      const [created] = await tx
        .insert(offer)
        .values({
          conversationId,
          postId: args.postId,
          responderId: args.responderId,
          amount: data.kind === "reserve" ? (target.priceAmount ?? 0) : (data.amount ?? 0),
          isReserve: data.kind === "reserve",
          quantity: data.quantity,
          expiresAt: new Date(now.getTime() + OFFER_DAYS * 24 * 60 * 60 * 1000),
        })
        .returning({ id: offer.id });
      await writeMessage(tx, {
        conversationId,
        senderId: args.responderId,
        data: { body: data.note, imageIds: [] },
        offerId: created.id,
        postId: args.postId,
      });
      recorded = await recordNotification(tx, {
        type: "offer_received",
        recipientId: target.ownerId,
        postId: args.postId,
        conversationId,
        onceKey: offerKey(created.id, "received"),
      });
      return { ok: true, conversationId, offerId: created.id };
    });
    if (result.ok && recorded?.alert) args.alert?.(recorded.id);
    return result;
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: PENDING_OFFER };
    throw error;
  }
}

/** The responder takes back their own pending offer. */
export async function withdrawOffer(args: { responderId: string; offerId: string; now?: Date }): Promise<DecisionResult> {
  const now = args.now ?? new Date();
  return getDb().transaction(async (tx): Promise<DecisionResult> => {
    const [found] = await tx
      .select({ conversationId: offer.conversationId, responderId: offer.responderId, status: offer.status })
      .from(offer)
      .where(eq(offer.id, args.offerId))
      .for("update", { of: offer });
    if (!found || found.responderId !== args.responderId) return { ok: false, error: OFFER_NOT_FOUND };
    if (found.status !== "pending") return { ok: false, error: OFFER_CLOSED };
    await tx.update(offer).set({ status: "withdrawn", decidedAt: now }).where(eq(offer.id, args.offerId));
    return { ok: true, conversationId: found.conversationId };
  });
}

/** The owner turns an offer down. The responder is told. */
export async function declineOffer(args: { ownerId: string; offerId: string; alert?: AlertSink; now?: Date }): Promise<DecisionResult> {
  const now = args.now ?? new Date();
  let recorded = null as Recorded | null;
  const result = await getDb().transaction(async (tx): Promise<DecisionResult> => {
    const [found] = await tx
      .select({
        conversationId: offer.conversationId,
        postId: post.id,
        ownerId: post.ownerId,
        responderId: offer.responderId,
        status: offer.status,
      })
      .from(offer)
      .innerJoin(post, eq(post.id, offer.postId))
      .where(eq(offer.id, args.offerId))
      .for("update", { of: offer });
    if (!found || found.ownerId !== args.ownerId) return { ok: false, error: OFFER_NOT_FOUND };
    if (found.status !== "pending") return { ok: false, error: OFFER_CLOSED };
    await tx.update(offer).set({ status: "declined", decidedAt: now }).where(eq(offer.id, args.offerId));
    recorded = await recordNotification(tx, {
      type: "offer_declined",
      recipientId: found.responderId,
      postId: found.postId,
      conversationId: found.conversationId,
      onceKey: offerKey(args.offerId, "declined"),
    });
    return { ok: true, conversationId: found.conversationId };
  });
  if (result.ok && recorded?.alert) args.alert?.(recorded.id);
  return result;
}
