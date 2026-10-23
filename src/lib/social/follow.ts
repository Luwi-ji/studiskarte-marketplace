import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { follow, image, school, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { shortSchool } from "@/lib/discovery/cards";
import { NO_SCHOOL_LABEL } from "@/lib/identity/roles";
import { blockedEitherWaySql, isBlockedEitherWay } from "@/lib/safety/block";

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

/** One person in a Followers or Following list. */
export type FollowListItem = { handle: string; displayName: string; school: string; avatarThumbKey: string | null };

/** How many people a list shows at first, and how many more each "Show more" adds. */
export const FOLLOW_LIST_STEP = 30;
/** The most one list will ever load, so a very long list cannot be asked for in one go. */
const FOLLOW_LIST_MAX = 3000;

/** A `?shown=` value from a URL: a multiple of the step from one step up to the maximum; anything else is the first step. */
export function parseShown(raw: string | string[] | undefined): number {
  const n = typeof raw === "string" && /^\d{1,4}$/.test(raw) ? Number(raw) : FOLLOW_LIST_STEP;
  return Math.min(FOLLOW_LIST_MAX, Math.max(FOLLOW_LIST_STEP, Math.ceil(n / FOLLOW_LIST_STEP) * FOLLOW_LIST_STEP));
}

/** Who may appear in a list the viewer reads: finished, active accounts, and nobody the viewer has blocked or who has blocked the viewer. */
function visibleTo(viewerId: string): SQL {
  return and(eq(student.accountStatus, "active"), sql`${student.handle} is not null`, sql`not ${blockedEitherWaySql(viewerId, student.id)}`)!;
}

/**
 * How many people follow a student, counting the same people the Followers list shows to this viewer.
 * Public to any signed-in student, like the profile.
 */
export async function countFollowers(viewerId: string, studentId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(follow)
    .innerJoin(student, eq(student.id, follow.followerId))
    .where(and(eq(follow.followeeId, studentId), visibleTo(viewerId)));
  return row.n;
}

/** How many people a student follows. Returns nothing unless the viewer is that student. */
export async function countFollowing(viewerId: string, subjectId: string): Promise<number> {
  if (viewerId !== subjectId) return 0;
  const [row] = await getDb()
    .select({ n: count() })
    .from(follow)
    .innerJoin(student, eq(student.id, follow.followeeId))
    .where(and(eq(follow.followerId, subjectId), visibleTo(viewerId)));
  return row.n;
}

type Listed = { items: FollowListItem[]; hasMore: boolean };

const listColumns = {
  handle: student.handle,
  displayName: student.name,
  schoolName: school.name,
  schoolDomain: school.domain,
  schoolShort: school.shortName,
  avatarThumbKey: image.thumbKey,
};

function toItems(rows: { handle: string | null; displayName: string; schoolName: string | null; schoolDomain: string | null; schoolShort: string | null; avatarThumbKey: string | null }[], limit: number): Listed {
  const items = rows.slice(0, limit).flatMap((row) =>
    row.handle
      ? [
          {
            handle: row.handle,
            displayName: row.displayName,
            school: row.schoolName ? shortSchool(row.schoolName, row.schoolShort) : (row.schoolDomain ?? NO_SCHOOL_LABEL),
            avatarThumbKey: row.avatarThumbKey,
          },
        ]
      : [],
  );
  return { items, hasMore: rows.length > limit };
}

/** The people who follow a student, newest follower first, as the viewer may see them. Public to any signed-in student. */
export async function listFollowers(viewerId: string, studentId: string, limit: number): Promise<Listed> {
  const rows = await getDb()
    .select(listColumns)
    .from(follow)
    .innerJoin(student, eq(student.id, follow.followerId))
    .leftJoin(school, eq(school.domain, student.schoolDomain))
    .leftJoin(image, eq(image.id, student.avatarImageId))
    .where(and(eq(follow.followeeId, studentId), visibleTo(viewerId)))
    .orderBy(desc(follow.createdAt), desc(follow.followerId))
    .limit(limit + 1);
  return toItems(rows, limit);
}

/** The people a student follows, newest first. The query itself enforces that only the owner may ask. */
export async function listFollowing(viewerId: string, subjectId: string, limit: number): Promise<Listed> {
  if (viewerId !== subjectId) return { items: [], hasMore: false };
  const rows = await getDb()
    .select(listColumns)
    .from(follow)
    .innerJoin(student, eq(student.id, follow.followeeId))
    .leftJoin(school, eq(school.domain, student.schoolDomain))
    .leftJoin(image, eq(image.id, student.avatarImageId))
    .where(and(eq(follow.followerId, subjectId), visibleTo(viewerId)))
    .orderBy(desc(follow.createdAt), desc(follow.followeeId))
    .limit(limit + 1);
  return toItems(rows, limit);
}
