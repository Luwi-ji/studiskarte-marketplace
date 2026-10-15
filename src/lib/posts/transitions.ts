import { and, eq } from "drizzle-orm";
import { post } from "@/db/schema";
import { getDb } from "@/lib/db";

/**
 * Withdraws an open post the student owns. Withdrawn is final: the post
 * leaves the feed and cannot be relisted (business logic, state transitions).
 * Returns false if the post is not the student's or not open.
 */
export async function withdrawPost(ownerId: string, postId: string): Promise<boolean> {
  const updated = await getDb()
    .update(post)
    .set({ status: "withdrawn", updatedAt: new Date() })
    .where(and(eq(post.id, postId), eq(post.ownerId, ownerId), eq(post.status, "open")))
    .returning({ id: post.id });
  return updated.length === 1;
}
