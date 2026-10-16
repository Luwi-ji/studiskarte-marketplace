import { and, asc, desc, eq, sql } from "drizzle-orm";
import { heart, image, post, postPhoto, school, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { liveForOthers } from "@/lib/posts/visibility";

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

const FEED_PAGE_SIZE = 30;

/**
 * Posts others may see, as cards: the first photo's thumbnail, price, title.
 * The column list is explicit so a student's email can never leak into a list.
 * Every list of posts (feed, profile, hearted) starts here.
 */
function visibleCards() {
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
    })
    .from(post)
    .innerJoin(student, eq(student.id, post.ownerId))
    .innerJoin(school, eq(school.domain, student.schoolDomain))
    .innerJoin(postPhoto, and(eq(postPhoto.postId, post.id), eq(postPhoto.position, 0)))
    .innerJoin(image, eq(image.id, postPhoto.imageId));
}

const live = () => and(liveForOthers(), eq(student.accountStatus, "active"));

/** Newest open and reserved posts. Follow-first ordering, filters and pagination arrive in Phase 6. */
export async function listFeed(limit = FEED_PAGE_SIZE): Promise<FeedItem[]> {
  return visibleCards().where(live()).orderBy(desc(post.listedAt), asc(post.id)).limit(limit);
}

/** A student's active listings, newest first (their public profile). */
export async function listPostsBy(ownerId: string, limit = 60): Promise<FeedItem[]> {
  return visibleCards()
    .where(and(live(), eq(post.ownerId, ownerId)))
    .orderBy(desc(post.listedAt), asc(post.id))
    .limit(limit);
}

/** Posts a student hearted that are still available, most recently hearted first. */
export async function listHeartedBy(studentId: string): Promise<FeedItem[]> {
  return visibleCards()
    .innerJoin(heart, and(eq(heart.postId, post.id), eq(heart.studentId, studentId)))
    .where(live())
    .orderBy(desc(heart.createdAt), asc(post.id));
}
