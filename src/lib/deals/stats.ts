import { and, desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { deal, post, review, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { blockedEitherWaySql } from "@/lib/safety/block";
import { DELETED_NAME } from "@/lib/identity/delete-account";

// On a Wishlist the one who supplies the item (the responder) is the seller and the one who posted it the buyer.
const sellerSql = sql`case when ${post.kind} = 'wishlist' then ${deal.responderId} else ${deal.ownerId} end`;
const buyerSql = sql`case when ${post.kind} = 'wishlist' then ${deal.ownerId} else ${deal.responderId} end`;

export type Reputation = {
  /** Null until the student has been reviewed once; the average is not rounded. */
  rating: { average: number; count: number } | null;
  /** Units handed over for a price, as the seller. */
  sold: number;
  /** Units handed over for free, as the giver. */
  granted: number;
  /** Units received for a price, as the buyer. */
  bought: number;
};

/**
 * What a student has earned: the stars they received and the units they handed
 * over or received in completed deals. Everything is counted when asked, never
 * stored. On a Wishlist the one who supplies the item (the responder) is the
 * seller and the one who posted it is the buyer. A free deal gives the receiver
 * no "bought".
 */
export async function getReputation(studentId: string): Promise<Reputation> {
  const db = getDb();
  const [stars] = await db
    .select({ count: sql<number>`count(*)::int`, average: sql<number | null>`avg(${review.rating})::float` })
    .from(review)
    .where(eq(review.revieweeId, studentId));

  const sellerId = sellerSql;
  const buyerId = buyerSql;
  const [units] = await db
    .select({
      sold: sql<number>`coalesce(sum(${deal.quantity}) filter (where ${sellerId} = ${studentId} and ${deal.amount} > 0), 0)::int`,
      granted: sql<number>`coalesce(sum(${deal.quantity}) filter (where ${sellerId} = ${studentId} and ${deal.amount} = 0), 0)::int`,
      bought: sql<number>`coalesce(sum(${deal.quantity}) filter (where ${buyerId} = ${studentId} and ${deal.amount} > 0), 0)::int`,
    })
    .from(deal)
    .innerJoin(post, eq(post.id, deal.postId))
    .where(and(eq(deal.status, "completed"), or(eq(deal.ownerId, studentId), eq(deal.responderId, studentId))));

  return {
    rating: stars.count === 0 || stars.average === null ? null : { average: stars.average, count: stars.count },
    sold: units.sold,
    granted: units.granted,
    bought: units.bought,
  };
}

/** How many rows one page of reviews or handovers holds. */
export const PROFILE_LIST_PAGE_SIZE = 20;

export type ListPage<T> = { items: T[]; hasMore: boolean };

/** A page number from a URL: a whole number from 1 up, anything else is the first page. */
export function parsePage(raw: string | string[] | undefined): number {
  const n = typeof raw === "string" && /^\d{1,4}$/.test(raw) ? Number(raw) : 1;
  return n >= 1 ? n : 1;
}

/**
 * The post's title for a transaction that already happened. A finished listing is
 * no longer in the feed, but its history is what builds credibility, so the title
 * stays visible whatever the post's status, except when an admin hid or removed the
 * post, its owner's account is not active, or the viewer and the owner blocked each
 * other. The owner and the student whose history this is always see it. Otherwise
 * null, and the title is never read. The query must join `student` on the post's owner.
 */
function titleFor(viewerId: string, subjectId: string) {
  return sql<string | null>`case when ${viewerId} = ${post.ownerId} or ${viewerId} = ${subjectId} or (${post.status} not in ('hidden', 'removed') and ${student.accountStatus} = 'active' and not ${blockedEitherWaySql(viewerId, post.ownerId)}) then ${post.title} end`;
}

export type ReviewItem = {
  id: string;
  rating: number;
  text: string | null;
  createdAt: Date;
  postKind: "showcase" | "wishlist";
  /** Null when the viewer cannot see the post today. */
  postTitle: string | null;
  /** Set only while the reviewer's account is active; the link target. */
  reviewerHandle: string | null;
  /** "@handle" for an active reviewer, "Deleted account" for a deleted one, otherwise "Student". */
  reviewerLabel: string;
};

/**
 * One page of the reviews a student received, newest first, for a signed-in
 * viewer: the kind of post, its title when the viewer may see that post, the
 * reviewer, stars, note and date. Nothing about price, place or the
 * reservation. A reviewer is shown by handle only while their account is
 * active; never by email.
 */
export async function listReviews(viewerId: string, revieweeId: string, page = 1, pageSize = PROFILE_LIST_PAGE_SIZE): Promise<ListPage<ReviewItem>> {
  const reviewer = alias(student, "reviewer");
  const rows = await getDb()
    .select({
      id: review.id,
      rating: review.rating,
      text: review.text,
      createdAt: review.createdAt,
      postKind: post.kind,
      postTitle: titleFor(viewerId, revieweeId),
      reviewerStatus: reviewer.accountStatus,
      reviewerHandle: reviewer.handle,
    })
    .from(review)
    .innerJoin(deal, eq(deal.id, review.dealId))
    .innerJoin(post, eq(post.id, deal.postId))
    .innerJoin(student, eq(student.id, post.ownerId))
    .leftJoin(reviewer, eq(reviewer.id, review.reviewerId))
    .where(eq(review.revieweeId, revieweeId))
    .orderBy(desc(review.createdAt), desc(review.id))
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize);
  return {
    items: rows.slice(0, pageSize).map((row) => {
      const active = row.reviewerStatus === "active" && row.reviewerHandle !== null && row.reviewerHandle !== "";
      return {
        id: row.id,
        rating: row.rating,
        text: row.text,
        createdAt: row.createdAt,
        postKind: row.postKind === "wishlist" ? "wishlist" : "showcase",
        postTitle: row.postTitle,
        reviewerHandle: active ? row.reviewerHandle : null,
        reviewerLabel: active ? `@${row.reviewerHandle}` : row.reviewerStatus === "deleted" ? DELETED_NAME : "Student",
      };
    }),
    hasMore: rows.length > pageSize,
  };
}

export type HandoverKind = "sold" | "granted" | "bought";

export type HandoverItem = {
  dealId: string;
  postKind: "showcase" | "wishlist";
  /** Null when the viewer cannot see the post today. */
  postTitle: string | null;
  quantity: number;
  /** When both people had confirmed the handover. */
  completedAt: Date;
};

/**
 * One page of the completed reservations behind a student's Sold, Granted or
 * Bought count, newest first: post kind, title when the viewer may see the
 * post, quantity and completion time, nothing else. Bought is private: for any
 * viewer other than the student it is an empty page.
 */
export async function listHandovers(args: {
  viewerId: string;
  studentId: string;
  kind: HandoverKind;
  page?: number;
  pageSize?: number;
}): Promise<ListPage<HandoverItem>> {
  const { viewerId, studentId, kind } = args;
  const page = args.page ?? 1;
  const pageSize = args.pageSize ?? PROFILE_LIST_PAGE_SIZE;
  if (kind === "bought" && viewerId !== studentId) return { items: [], hasMore: false };

  const side = kind === "bought" ? buyerSql : sellerSql;
  const priced = kind === "granted" ? sql`${deal.amount} = 0` : sql`${deal.amount} > 0`;
  const completedAt = sql<Date>`greatest(${deal.ownerConfirmedAt}, ${deal.responderConfirmedAt})`;
  const rows = await getDb()
    .select({
      dealId: deal.id,
      postKind: post.kind,
      postTitle: titleFor(viewerId, studentId),
      quantity: deal.quantity,
      completedAt: sql<string>`${completedAt}`.mapWith((v) => new Date(v)),
    })
    .from(deal)
    .innerJoin(post, eq(post.id, deal.postId))
    .innerJoin(student, eq(student.id, post.ownerId))
    .where(and(eq(deal.status, "completed"), sql`${side} = ${studentId}`, priced))
    .orderBy(desc(completedAt), desc(deal.id))
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize);
  return {
    items: rows.slice(0, pageSize).map((row) => ({
      dealId: row.dealId,
      postKind: row.postKind === "wishlist" ? "wishlist" : "showcase",
      postTitle: row.postTitle,
      quantity: row.quantity,
      completedAt: row.completedAt,
    })),
    hasMore: rows.length > pageSize,
  };
}
