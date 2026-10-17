import { and, count, eq, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { deal, offer, post, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { ACTIVE_STATUSES, syncAvailability, unitsLeft, unitsTaken } from "@/lib/deals/capacity";
import { OFFER_CLOSED, OFFER_NOT_FOUND, type DecisionResult } from "@/lib/deals/offers";
import { RESERVED_POST } from "@/lib/deals/rules";
import { CLOSED_ACCOUNT, CLOSED_POST } from "@/lib/messaging/rules";
import { isUniqueViolation } from "@/lib/messaging/send";
import { offerKey, recordNotification, type AlertSink } from "@/lib/notifications/record";

const OFFER_EXPIRED = "This offer has expired.";
const ALREADY_RESERVED = "This buyer already has a reservation on this post.";

type Told = { recipientId: string; conversationId: string; offerId: string; type: "offer_accepted" | "offer_declined" };

/**
 * The owner accepts an offer. In one step that cannot be interleaved with
 * another accept on the same post: a deal for the offer's units is created
 * and the offer accepted. If that uses the last unit, the post becomes Fully
 * reserved and every other pending offer is declined; otherwise the post stays
 * open and the other offers stay pending. Two accepts at once never use more
 * units than the post has. Everyone whose offer was decided is told afterwards.
 */
export async function acceptOffer(args: { ownerId: string; offerId: string; alert?: AlertSink; now?: Date }): Promise<DecisionResult> {
  const now = args.now ?? new Date();
  const owner = alias(student, "owner");
  const responder = alias(student, "responder");
  const told: Told[] = [];
  let postId = "";

  try {
    const result = await getDb().transaction(async (tx): Promise<DecisionResult> => {
      const [ref] = await tx
        .select({ postId: offer.postId })
        .from(offer)
        .where(eq(offer.id, args.offerId));
      if (!ref) return { ok: false, error: OFFER_NOT_FOUND };

      // The post is locked first, so two accepts on one post line up one behind the other.
      const [target] = await tx
        .select({
          ownerId: post.ownerId,
          status: post.status,
          expiresAt: post.expiresAt,
          quantity: post.quantity,
          ownerStatus: owner.accountStatus,
        })
        .from(post)
        .innerJoin(owner, eq(owner.id, post.ownerId))
        .where(eq(post.id, ref.postId))
        .for("update", { of: post });
      if (!target || target.ownerId !== args.ownerId) return { ok: false, error: OFFER_NOT_FOUND };

      const [found] = await tx
        .select({
          conversationId: offer.conversationId,
          responderId: offer.responderId,
          status: offer.status,
          expiresAt: offer.expiresAt,
          amount: offer.amount,
          quantity: offer.quantity,
          responderStatus: responder.accountStatus,
        })
        .from(offer)
        .innerJoin(responder, eq(responder.id, offer.responderId))
        .where(eq(offer.id, args.offerId))
        .for("update", { of: offer });
      if (!found) return { ok: false, error: OFFER_NOT_FOUND };
      if (found.status !== "pending") return { ok: false, error: OFFER_CLOSED };
      if (found.expiresAt.getTime() <= now.getTime()) {
        await tx.update(offer).set({ status: "expired", decidedAt: now }).where(eq(offer.id, args.offerId));
        return { ok: false, error: OFFER_EXPIRED };
      }
      if (target.ownerStatus !== "active" || found.responderStatus !== "active") return { ok: false, error: CLOSED_ACCOUNT };
      if (target.status === "reserved") return { ok: false, error: RESERVED_POST };
      if (target.status !== "open" || target.expiresAt.getTime() <= now.getTime()) return { ok: false, error: CLOSED_POST };

      const left = unitsLeft(target.quantity, await unitsTaken(tx, ref.postId));
      if (left !== null && found.quantity > left) {
        return {
          ok: false,
          error: left === 0 ? RESERVED_POST : `Only ${left} left, but this offer is for ${found.quantity}. Decline it and ask for ${left}.`,
        };
      }
      const [existing] = await tx
        .select({ n: count() })
        .from(deal)
        .where(and(eq(deal.postId, ref.postId), eq(deal.responderId, found.responderId), inArray(deal.status, [...ACTIVE_STATUSES])));
      if (existing.n > 0) return { ok: false, error: ALREADY_RESERVED };

      await tx.insert(deal).values({
        postId: ref.postId,
        offerId: args.offerId,
        ownerId: args.ownerId,
        responderId: found.responderId,
        amount: found.amount,
        quantity: found.quantity,
        activityAt: now,
      });
      await tx.update(offer).set({ status: "accepted", decidedAt: now }).where(eq(offer.id, args.offerId));
      const statusNow = await syncAvailability(tx, ref.postId, now);

      postId = ref.postId;
      told.push({ recipientId: found.responderId, conversationId: found.conversationId, offerId: args.offerId, type: "offer_accepted" });

      // Only when that was the last unit do the other offers have nothing left to ask for.
      if (statusNow !== "open") {
        const declined = await tx
          .update(offer)
          .set({ status: "declined", decidedAt: now })
          .where(and(eq(offer.status, "pending"), ne(offer.id, args.offerId), eq(offer.postId, ref.postId)))
          .returning({ id: offer.id, conversationId: offer.conversationId, responderId: offer.responderId });
        for (const d of declined) {
          told.push({ recipientId: d.responderId, conversationId: d.conversationId, offerId: d.id, type: "offer_declined" });
        }
      }
      return { ok: true, conversationId: found.conversationId };
    });

    if (result.ok) {
      for (const t of told) {
        const recorded = await recordNotification(getDb(), {
          type: t.type,
          recipientId: t.recipientId,
          postId,
          conversationId: t.conversationId,
          onceKey: offerKey(t.offerId, t.type === "offer_accepted" ? "accepted" : "declined"),
        });
        if (recorded?.alert) args.alert?.(recorded.id);
      }
    }
    return result;
  } catch (error) {
    // The database also guards one active deal per buyer and the post's units, so a lost race ends here too.
    if (isUniqueViolation(error)) return { ok: false, error: OFFER_CLOSED };
    throw error;
  }
}
