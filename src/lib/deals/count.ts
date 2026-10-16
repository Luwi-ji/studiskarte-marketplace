import { and, count, eq, gt } from "drizzle-orm";
import { conversation, offer } from "@/db/schema";
import { getDb } from "@/lib/db";

/** Offers on a post that are waiting for the owner (pending and not yet out of time). */
export async function countPendingOffers(postId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(offer)
    .innerJoin(conversation, eq(conversation.id, offer.conversationId))
    .where(and(eq(conversation.postId, postId), eq(offer.status, "pending"), gt(offer.expiresAt, new Date())));
  return row.n;
}
