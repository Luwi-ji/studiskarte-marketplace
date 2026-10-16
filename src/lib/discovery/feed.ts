import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { follow, heart, image, post, postPhoto, school, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { visibleToOthers } from "@/lib/discovery/visibility";

export type FeedItem = {
  id: string;
  kind: string;
  title: string;
  priceKind: string;
  priceAmount: number | null;
  listedAt: Date;
  /** Null only for posts made before the owner finished sign-up. */
  ownerHandle: string | null;
  /** The school's name, or its email domain until the owner names it. */
  school: string;
  thumbKey: string;
};

export const FEED_PAGE_SIZE = 30;

/**
 * Posts others may see, as cards: the first photo's thumbnail, price, title.
 * The column list is explicit so a student's email can never leak into a list.
 * Every list of posts (feed, profile, hearted) starts here; `extra` adds
 * columns a list needs for its own ordering.
 */
function visibleCards<E extends Record<string, SQL>>(extra: E) {
  return getDb()
    .select({
      id: post.id,
      kind: post.kind,
      title: post.title,
      priceKind: post.priceKind,
      priceAmount: post.priceAmount,
      listedAt: post.listedAt,
      ownerHandle: student.handle,
      school: sql<string>`coalesce(${school.name}, ${school.domain})`,
      thumbKey: image.thumbKey,
      ...extra,
    })
    .from(post)
    .innerJoin(student, eq(student.id, post.ownerId))
    .innerJoin(school, eq(school.domain, student.schoolDomain))
    .innerJoin(postPhoto, and(eq(postPhoto.postId, post.id), eq(postPhoto.position, 0)))
    .innerJoin(image, eq(image.id, postPhoto.imageId));
}

// Where the next page starts: after the post with this followed flag, listing
// time and id. The time is Postgres's own text, so no precision is lost.
const cursorSchema = z.object({ f: z.union([z.literal(0), z.literal(1)]), t: z.string().max(40), id: z.uuid() });
type Cursor = z.infer<typeof cursorSchema>;

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

/** An unreadable or tampered cursor is treated as no cursor: the first page. */
function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw || raw.length > 200) return null;
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return parsed.success && !Number.isNaN(Date.parse(parsed.data.t)) ? parsed.data : null;
  } catch {
    return null;
  }
}

export type FeedPage = { items: FeedItem[]; nextCursor: string | null };

/**
 * One page of the feed: posts from students the viewer follows first, then
 * everyone else's, each group newest first. A viewer who follows nobody sees
 * newest first. Pages are keyed on (followed, listed time, id), so a post
 * listed or expired while scrolling never repeats or skips another one.
 */
export async function listFeed(viewerId: string, options: { cursor?: string | null; limit?: number } = {}): Promise<FeedPage> {
  const limit = options.limit ?? FEED_PAGE_SIZE;
  const cursor = decodeCursor(options.cursor);
  const followed = sql<number>`(case when exists (select 1 from ${follow} where ${follow.followerId} = ${viewerId} and ${follow.followeeId} = ${post.ownerId}) then 1 else 0 end)`;

  const rows = await visibleCards({ followed, listedKey: sql<string>`${post.listedAt}::text` })
    .where(
      and(
        visibleToOthers(),
        cursor
          ? sql`(${followed}, ${post.listedAt}, ${post.id}) < (${cursor.f}::int, ${cursor.t}::timestamptz, ${cursor.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(followed), desc(post.listedAt), desc(post.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const items: FeedItem[] = page.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    priceKind: row.priceKind,
    priceAmount: row.priceAmount,
    listedAt: row.listedAt,
    ownerHandle: row.ownerHandle,
    school: row.school,
    thumbKey: row.thumbKey,
  }));
  return {
    items,
    nextCursor: rows.length > limit && last ? encodeCursor({ f: last.followed === 1 ? 1 : 0, t: last.listedKey, id: last.id }) : null,
  };
}

/** A student's active listings, newest first (their public profile). */
export async function listPostsBy(ownerId: string, limit = 60): Promise<FeedItem[]> {
  return visibleCards({})
    .where(and(visibleToOthers(), eq(post.ownerId, ownerId)))
    .orderBy(desc(post.listedAt), desc(post.id))
    .limit(limit);
}

/** Posts a student hearted that are still available, most recently hearted first. */
export async function listHeartedBy(studentId: string): Promise<FeedItem[]> {
  return visibleCards({})
    .innerJoin(heart, and(eq(heart.postId, post.id), eq(heart.studentId, studentId)))
    .where(visibleToOthers())
    .orderBy(desc(heart.createdAt), desc(post.id));
}
