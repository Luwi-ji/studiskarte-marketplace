import { and, eq, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { conversation, deal, offer, post, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { OFFER_CLOSED, OFFER_NOT_FOUND, type DecisionResult } from "@/lib/deals/offers";
import { RESERVED_POST } from "@/lib/deals/rules";
import { CLOSED_ACCOUNT, CLOSED_POST } from "@/lib/messaging/rules";
import { isUniqueViolation } from "@/lib/messaging/send";
import { offerKey, recordNotification, type AlertSink } from "@/lib/notifications/record";

const OFFER_EXPIRED = "This offer has expired.";

type Told = { recipientId: string; conversationId: string; offerId: string; type: "offer_accepted" | "offer_declined" };

/**
 * The owner accepts an offer. In one step that cannot be interleaved with
 * another accept on the same post: a deal is created, the post becomes
 * reserved, the offer is accepted and every other pending offer on the post is
 * declined. Two accepts at once leave exactly one deal; the other is refused.
 * Everyone whose offer was decided is told afterwards.
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
        .select({ postId: conversation.postId })
        .from(offer)
        .innerJoin(conversation, eq(conversation.id, offer.conversationId))
        .where(eq(offer.id, args.offerId));
      if (!ref) return { ok: false, error: OFFER_NOT_FOUND };

      // The post is locked first, so two accepts on one post line up one behind the other.
      const [target] = await tx
        .select({ ownerId: post.ownerId, status: post.status, expiresAt: post.expiresAt, ownerStatus: owner.accountStatus })
        .from(post)
        .innerJoin(owner, eq(owner.id, post.ownerId))
        .where(eq(post.id, ref.postId))
        .for("update", { of: post });
      if (!target || target.ownerId !== args.ownerId) return { ok: false, error: OFFER_NOT_FOUND };

      const [found] = await tx
        .select({
          conversationId: offer.conversationId,
          responderId: conversation.responderId,
          status: offer.status,
          expiresAt: offer.expiresAt,
          amount: offer.amount,
          responderStatus: responder.accountStatus,
        })
        .from(offer)
        .innerJoin(conversation, eq(conversation.id, offer.conversationId))
        .innerJoin(responder, eq(responder.id, conversation.responderId))
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

      await tx.insert(deal).values({
        postId: ref.postId,
        offerId: args.offerId,
        ownerId: args.ownerId,
        responderId: found.responderId,
        amount: found.amount,
      });
      await tx.update(offer).set({ status: "accepted", decidedAt: now }).where(eq(offer.id, args.offerId));
      const declined = await tx
        .update(offer)
        .set({ status: "declined", decidedAt: now })
        .where(
          and(
            eq(offer.status, "pending"),
            ne(offer.id, args.offerId),
            inArray(offer.conversationId, tx.select({ id: conversation.id }).from(conversation).where(eq(conversation.postId, ref.postId))),
          ),
        )
        .returning({ id: offer.id, conversationId: offer.conversationId });
      await tx.update(post).set({ status: "reserved", updatedAt: now }).where(eq(post.id, ref.postId));

      postId = ref.postId;
      told.push({ recipientId: found.responderId, conversationId: found.conversationId, offerId: args.offerId, type: "offer_accepted" });
      if (declined.length > 0) {
        const people = await tx
          .select({ id: conversation.id, responderId: conversation.responderId })
          .from(conversation)
          .where(inArray(conversation.id, declined.map((d) => d.conversationId)));
        const responderOf = new Map(people.map((p) => [p.id, p.responderId]));
        for (const d of declined) {
          const recipientId = responderOf.get(d.conversationId);
          if (recipientId) told.push({ recipientId, conversationId: d.conversationId, offerId: d.id, type: "offer_declined" });
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
    // The database allows one active deal per post, so a lost race ends here too.
    if (isUniqueViolation(error)) return { ok: false, error: OFFER_CLOSED };
    throw error;
  }
}
