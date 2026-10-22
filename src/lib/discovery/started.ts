import { eq, or } from "drizzle-orm";
import { conversation, post } from "@/db/schema";
import { getDb } from "@/lib/db";

/**
 * Whether a member has done either thing the first-session strip asks for: made a post, or
 * taken part in a conversation. A post she later deleted still counts.
 */
export async function hasStarted(studentId: string): Promise<boolean> {
  const db = getDb();
  const [posted, talked] = await Promise.all([
    db.select({ id: post.id }).from(post).where(eq(post.ownerId, studentId)).limit(1),
    db
      .select({ id: conversation.id })
      .from(conversation)
      .where(or(eq(conversation.participantA, studentId), eq(conversation.participantB, studentId)))
      .limit(1),
  ]);
  return posted.length > 0 || talked.length > 0;
}
