import { and, count, eq, ne } from "drizzle-orm";
import { post, postView, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { manilaToday } from "@/lib/posts/schema";
import { liveForOthers } from "@/lib/posts/visibility";

/**
 * Counts a view when a signed-in student other than the owner opens a post
 * others can see, at most once per student per post per day (Manila time).
 * Never counts the owner. Returns whether a new view was recorded.
 */
export async function recordView(viewerId: string, postId: string, now = new Date()): Promise<boolean> {
  const db = getDb();
  const [visible] = await db
    .select({ id: post.id })
    .from(post)
    .innerJoin(student, eq(student.id, post.ownerId))
    .where(
      and(eq(post.id, postId), ne(post.ownerId, viewerId), liveForOthers(), eq(student.accountStatus, "active")),
    );
  if (!visible) return false;

  // The primary key (post, viewer, day) makes a second open the same day a no-op.
  const inserted = await db
    .insert(postView)
    .values({ postId, viewerId, day: manilaToday(now) })
    .onConflictDoNothing()
    .returning({ postId: postView.postId });
  return inserted.length === 1;
}

/** How many student-days opened this post. Only ever shown to the owner. */
export async function countViews(postId: string): Promise<number> {
  const [row] = await getDb().select({ n: count() }).from(postView).where(eq(postView.postId, postId));
  return row.n;
}
