import { and, desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { deal, post, review, student } from "@/db/schema";
import { getDb } from "@/lib/db";

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

  const sellerId = sql`case when ${post.kind} = 'wishlist' then ${deal.responderId} else ${deal.ownerId} end`;
  const buyerId = sql`case when ${post.kind} = 'wishlist' then ${deal.ownerId} else ${deal.responderId} end`;
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

export type ReviewItem = { id: string; rating: number; text: string | null; createdAt: Date; postTitle: string; reviewerName: string };

/**
 * The reviews a student received, newest first, with the title of what was
 * handed over. The reviewer is shown by name only while their account is
 * active; never by email or handle.
 */
export async function listReviews(revieweeId: string, limit = 20): Promise<ReviewItem[]> {
  const reviewer = alias(student, "reviewer");
  const rows = await getDb()
    .select({
      id: review.id,
      rating: review.rating,
      text: review.text,
      createdAt: review.createdAt,
      postTitle: post.title,
      reviewerStatus: reviewer.accountStatus,
      reviewerName: reviewer.name,
    })
    .from(review)
    .innerJoin(deal, eq(deal.id, review.dealId))
    .innerJoin(post, eq(post.id, deal.postId))
    .leftJoin(reviewer, eq(reviewer.id, review.reviewerId))
    .where(eq(review.revieweeId, revieweeId))
    .orderBy(desc(review.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    text: row.text,
    createdAt: row.createdAt,
    postTitle: row.postTitle,
    reviewerName: row.reviewerStatus === "active" && row.reviewerName !== "" && row.reviewerName !== null ? row.reviewerName : row.reviewerStatus === "deleted" ? "Deleted student" : "Student",
  }));
}
