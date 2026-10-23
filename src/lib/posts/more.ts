import { and, eq, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { category, post, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { visibleCards, type FeedItem } from "@/lib/discovery/feed";
import { visibleToOthers } from "@/lib/discovery/visibility";

/** How many listings the first batch under a post holds, so the post itself stays fast. */
export const MORE_FIRST_BATCH = 8;
export const MORE_PAGE_SIZE = 12;

/** 0 = another listing by the same seller, 1 = a listing in the same category by someone else. */
export type MoreGroup = 0 | 1;

export type MoreItem = FeedItem & { group: MoreGroup };

export type MorePage = { items: MoreItem[]; nextCursor: string | null };

/** What the lists under a post are built from: its seller and category, with the names the headings show. */
export type MoreContext = {
  postId: string;
  ownerId: string;
  ownerHandle: string | null;
  categoryId: string;
  categoryName: string;
};

/** The post's seller and category, or null when the viewer may not see the post. */
export async function moreContext(viewerId: string, postId: string): Promise<MoreContext | null> {
  if (!z.uuid().safeParse(postId).success) return null;
  const [row] = await getDb()
    .select({
      ownerId: post.ownerId,
      ownerHandle: student.handle,
      categoryId: post.categoryId,
      categoryName: category.name,
    })
    .from(post)
    .innerJoin(student, eq(student.id, post.ownerId))
    .innerJoin(category, eq(category.id, post.categoryId))
    .where(and(eq(post.id, postId), visibleToOthers(viewerId)))
    .limit(1);
  return row ? { postId, ...row } : null;
}

// Where the next page starts: after the post with this group, listing time and
// id. The time is Postgres's own text, so no precision is lost.
const cursorSchema = z.object({
  g: z.number().int().min(0).max(1),
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

/**
 * Listings to keep reading under a post: first the same seller's other
 * listings, then listings in the same category from other students, each group
 * newest first. It uses the rule every list uses (visibleToOthers) and no
 * school filter, because the feed has none by default. The post itself never
 * appears. Pages are keyed on group, listed time and id, like the feed's.
 */
export async function listMoreLikeThis(
  viewerId: string,
  context: Pick<MoreContext, "postId" | "ownerId" | "categoryId">,
  options: { cursor?: string | null; limit?: number } = {},
): Promise<MorePage> {
  const limit = options.limit ?? MORE_PAGE_SIZE;
  const cursor = decodeCursor(options.cursor);
  const group = sql<number>`(case when ${post.ownerId} = ${context.ownerId} then 0 else 1 end)`;

  const afterCursor: SQL | undefined = cursor
    ? or(
        sql`${group} > ${cursor.g}::int`,
        and(sql`${group} = ${cursor.g}::int`, sql`${post.listedAt} < ${cursor.t}::timestamptz`),
        and(sql`${group} = ${cursor.g}::int`, sql`${post.listedAt} = ${cursor.t}::timestamptz`, sql`${post.id} < ${cursor.id}::uuid`),
      )
    : undefined;

  const rows = await visibleCards(viewerId, { group, listedKey: sql<string>`${post.listedAt}::text` })
    .where(
      and(
        visibleToOthers(viewerId),
        ne(post.id, context.postId),
        or(eq(post.ownerId, context.ownerId), eq(post.categoryId, context.categoryId)),
        afterCursor,
      ),
    )
    .orderBy(group, sql`${post.listedAt} desc`, sql`${post.id} desc`)
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const items: MoreItem[] = page.map((row) => ({
    id: row.id,
    kind: row.kind,
    status: row.status,
    title: row.title,
    priceKind: row.priceKind,
    priceAmount: row.priceAmount,
    listedAt: row.listedAt,
    ownerHandle: row.ownerHandle,
    school: row.school,
    schoolShort: row.schoolShort,
    meetupLocation: row.meetupLocation,
    hearted: row.hearted,
    thumbKey: row.thumbKey,
    group: Number(row.group) === 0 ? 0 : 1,
  }));
  return {
    items,
    nextCursor: rows.length > limit && last ? encodeCursor({ g: Number(last.group) === 0 ? 0 : 1, t: last.listedKey, id: last.id }) : null,
  };
}
