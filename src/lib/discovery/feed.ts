import { and, asc, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { follow, heart, image, post, postPhoto, school, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { NO_SCHOOL_LABEL } from "@/lib/identity/roles";
import { allFilterConditions, DEFAULT_FILTERS, priceKey, type Filters, type Sort } from "@/lib/discovery/filters";
import { visibleToOthers } from "@/lib/discovery/visibility";

export type FeedItem = {
  id: string;
  kind: string;
  title: string;
  priceKind: string;
  priceAmount: number | null;
  /** "open" or "reserved": the only states others can see. */
  status: string;
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
      status: post.status,
      listedAt: post.listedAt,
      ownerHandle: student.handle,
      school: sql<string>`coalesce(${school.name}, ${school.domain}, ${NO_SCHOOL_LABEL})`,
      thumbKey: image.thumbKey,
      ...extra,
    })
    .from(post)
    .innerJoin(student, eq(student.id, post.ownerId))
    .leftJoin(school, eq(school.domain, student.schoolDomain))
    .innerJoin(postPhoto, and(eq(postPhoto.postId, post.id), eq(postPhoto.position, 0)))
    .innerJoin(image, eq(image.id, postPhoto.imageId));
}

// Where the next page starts: after the post with this sort key, listing time
// and id. The time is Postgres's own text, so no precision is lost. The key is
// 0 or 1 ("followed") for the default order, or the price for price sorts.
const cursorSchema = z.object({
  k: z.number().int().min(-1).max(2_000_000_000),
  t: z.string().max(40),
  id: z.uuid(),
});
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

// Negotiable posts have no price: they come last in both price orders.
const NO_PRICE_LAST_ASC = 2_000_000_000;
const NO_PRICE_LAST_DESC = -1;

/**
 * How a sort orders posts. The first key is the sort itself; listing time and
 * id (both newest/greatest first) break ties, so every post has one place.
 * Only the default sort, without a search, puts followed students first.
 */
function orderFor(sort: Sort, searching: boolean, viewerId: string): { key: SQL; dir: "asc" | "desc" } {
  if (sort === "price_low") return { key: sql`coalesce(${priceKey}, ${NO_PRICE_LAST_ASC})`, dir: "asc" };
  if (sort === "price_high") return { key: sql`coalesce(${priceKey}, ${NO_PRICE_LAST_DESC})`, dir: "desc" };
  // Cast, so ORDER BY sees an expression and not a column number.
  if (searching) return { key: sql`(0)::int`, dir: "desc" };
  return {
    key: sql`(case when exists (select 1 from ${follow} where ${follow.followerId} = ${viewerId} and ${follow.followeeId} = ${post.ownerId}) then 1 else 0 end)`,
    dir: "desc",
  };
}

/** Rows strictly after the cursor in an order of (key, listed time desc, id desc). */
function after(key: SQL, dir: "asc" | "desc", cursor: Cursor): SQL {
  const sameKey = sql`${key} = ${cursor.k}::int`;
  const sameTime = sql`${post.listedAt} = ${cursor.t}::timestamptz`;
  return or(
    sql`${key} ${dir === "asc" ? sql`>` : sql`<`} ${cursor.k}::int`,
    and(sameKey, sql`${post.listedAt} < ${cursor.t}::timestamptz`),
    and(sameKey, sameTime, sql`${post.id} < ${cursor.id}::uuid`),
  ) as SQL;
}

export type FeedPage = { items: FeedItem[]; nextCursor: string | null };

/**
 * One page of the feed. By default posts from students the viewer follows come
 * first, then everyone else's, each newest first; a viewer who follows nobody
 * sees newest first. Picking a price sort, or searching, drops the follow
 * order. Filters and search words must all match. Pages are keyed on the sort
 * key, listed time and id, so a post listed or expired while scrolling never
 * repeats or skips another one.
 */
export async function listFeed(
  viewerId: string,
  options: { filters?: Filters; cursor?: string | null; limit?: number } = {},
): Promise<FeedPage> {
  const limit = options.limit ?? FEED_PAGE_SIZE;
  const filters = options.filters ?? DEFAULT_FILTERS;
  const cursor = decodeCursor(options.cursor);
  const { key, dir } = orderFor(filters.sort, filters.query !== undefined, viewerId);

  const rows = await visibleCards({ sortKey: sql<number>`${key}`, listedKey: sql<string>`${post.listedAt}::text` })
    .where(and(visibleToOthers(viewerId), allFilterConditions(filters), cursor ? after(key, dir, cursor) : undefined))
    .orderBy(dir === "asc" ? asc(key) : desc(key), desc(post.listedAt), desc(post.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const items: FeedItem[] = page.map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
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
    nextCursor: rows.length > limit && last ? encodeCursor({ k: Number(last.sortKey), t: last.listedKey, id: last.id }) : null,
  };
}

/** A student's active listings as the viewer may see them, newest first (their public profile). */
export async function listPostsBy(viewerId: string, ownerId: string, limit = 60): Promise<FeedItem[]> {
  return visibleCards({})
    .where(and(visibleToOthers(viewerId), eq(post.ownerId, ownerId)))
    .orderBy(desc(post.listedAt), desc(post.id))
    .limit(limit);
}

/** Posts a student hearted that are still available, most recently hearted first. */
export async function listHeartedBy(studentId: string): Promise<FeedItem[]> {
  return visibleCards({})
    .innerJoin(heart, and(eq(heart.postId, post.id), eq(heart.studentId, studentId)))
    .where(visibleToOthers(studentId))
    .orderBy(desc(heart.createdAt), desc(post.id));
}
