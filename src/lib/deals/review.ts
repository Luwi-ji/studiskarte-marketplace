import { eq } from "drizzle-orm";
import { z } from "zod";
import { review, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { DEAL_NOT_FOUND } from "@/lib/deals/cancel";
import { lockDeal } from "@/lib/deals/lock";
import type { HandoverResult } from "@/lib/deals/schedule";
import { isUniqueViolation } from "@/lib/messaging/send";

export const NOT_COMPLETED = "You can review once the handover is complete.";
export const ALREADY_REVIEWED = "You already reviewed this one.";
export const OTHER_CLOSED = "That student's account is closed.";
export const TEXT_MAX = 500;

const inputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().max(TEXT_MAX).default(""),
});

/**
 * Either person rates the other once a deal is completed: 1 to 5 stars and an
 * optional note. One review each per deal, never edited (the database refuses
 * a second one and any change). A student whose account is closed cannot be
 * reviewed.
 */
export async function submitReview(args: { actorId: string; dealId: string; input: unknown }): Promise<HandoverResult> {
  const parsed = inputSchema.safeParse(args.input);
  if (!parsed.success) return { ok: false, error: "Choose 1 to 5 stars." };
  const text = parsed.data.text.trim();

  try {
    return await getDb().transaction(async (tx): Promise<HandoverResult> => {
      const found = await lockDeal(tx, args.dealId);
      if (!found || (found.ownerId !== args.actorId && found.responderId !== args.actorId)) return { ok: false, error: DEAL_NOT_FOUND };
      if (found.status !== "completed") return { ok: false, error: NOT_COMPLETED };

      const revieweeId = found.ownerId === args.actorId ? found.responderId : found.ownerId;
      const [other] = await tx.select({ status: student.accountStatus }).from(student).where(eq(student.id, revieweeId));
      if (other?.status !== "active") return { ok: false, error: OTHER_CLOSED };

      await tx.insert(review).values({ dealId: found.id, reviewerId: args.actorId, revieweeId, rating: parsed.data.rating, text: text === "" ? null : text });
      return { ok: true, conversationId: found.conversationId };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, error: ALREADY_REVIEWED };
    throw error;
  }
}
