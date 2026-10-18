import { and, eq } from "drizzle-orm";
import { follow, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { isBlockedEitherWay } from "@/lib/safety/block";

export type FollowResult = "ok" | "self" | "not_found";

/** Follows a student by id. Doing it twice is the same as once. A student cannot follow themselves. */
export async function followStudent(followerId: string, followeeId: string): Promise<FollowResult> {
  if (followerId === followeeId) return "self";
  const db = getDb();
  const [target] = await db
    .select({ id: student.id, handle: student.handle })
    .from(student)
    .where(and(eq(student.id, followeeId), eq(student.accountStatus, "active")));
  if (!target?.handle || (await isBlockedEitherWay(followerId, followeeId))) return "not_found";
  await db.insert(follow).values({ followerId, followeeId }).onConflictDoNothing();
  return "ok";
}

/** Stops following. Safe when the student was not followed. */
export async function unfollowStudent(followerId: string, followeeId: string): Promise<void> {
  await getDb()
    .delete(follow)
    .where(and(eq(follow.followerId, followerId), eq(follow.followeeId, followeeId)));
}
