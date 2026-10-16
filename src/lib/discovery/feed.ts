import { and, asc, desc, eq, sql } from "drizzle-orm";
import { image, post, postPhoto, school, student } from "@/db/schema";
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
 * Newest open and reserved posts, with the first photo's thumbnail.
 * The column list is explicit so a student's email can never leak into a feed.
 * Follow-first ordering, filters and pagination arrive in later phases.
 */
export async function listFeed(limit = FEED_PAGE_SIZE): Promise<FeedItem[]> {
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
    .innerJoin(image, eq(image.id, postPhoto.imageId))
    .where(and(liveForOthers(), eq(student.accountStatus, "active")))
    .orderBy(desc(post.listedAt), asc(post.id))
    .limit(limit);
}
