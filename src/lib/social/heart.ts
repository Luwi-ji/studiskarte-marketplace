import { and, count, eq, notInArray } from "drizzle-orm";
import { heart, post, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { visibleToOthers } from "@/lib/discovery/visibility";

export type HeartResult = "ok" | "own_post" | "not_found";

/**
 * Hearts a post, privately. Only a post others can see may be hearted, and
 * never your own. Doing it twice is the same as once.
 */
export async function heartPost(studentId: string, postId: string): Promise<HeartResult> {
  const db = getDb();
  const [target] = await db
    .select({ id: post.id, ownerId: post.ownerId })
    .from(post)
    .innerJoin(student, eq(student.id, post.ownerId))
    .where(and(eq(post.id, postId), visibleToOthers()));
  if (!target) return "not_found";
  if (target.ownerId === studentId) return "own_post";
  await db.insert(heart).values({ studentId, postId }).onConflictDoNothing();
  return "ok";
}

/** Removes the student's own heart. Works on any post, including one no longer available. */
export async function unheartPost(studentId: string, postId: string): Promise<void> {
  await getDb()
    .delete(heart)
    .where(and(eq(heart.studentId, studentId), eq(heart.postId, postId)));
}

export async function hasHearted(studentId: string, postId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(heart)
    .where(and(eq(heart.studentId, studentId), eq(heart.postId, postId)));
  return row.n > 0;
}

/** How many students hearted a post. Shown to the post's owner only, and never who. */
export async function countHearts(postId: string): Promise<number> {
  const [row] = await getDb().select({ n: count() }).from(heart).where(eq(heart.postId, postId));
  return row.n;
}

/**
 * Hearts the student gave to posts that are no longer available (closed,
 * expired, hidden, withdrawn). They stay in the list as "no longer available",
 * with nothing about the post, so the student can remove them.
 */
export async function listUnavailableHearts(studentId: string, availableIds: string[]): Promise<string[]> {
  const rows = await getDb()
    .select({ postId: heart.postId })
    .from(heart)
    .where(
      and(eq(heart.studentId, studentId), availableIds.length > 0 ? notInArray(heart.postId, availableIds) : undefined),
    );
  return rows.map((row) => row.postId);
}

