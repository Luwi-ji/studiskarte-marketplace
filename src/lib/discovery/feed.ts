import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { image, post, postPhoto, student } from "@/db/schema";
import { getDb } from "@/lib/db";

export type FeedItem = {
  id: string;
  kind: string;
  title: string;
  listedAt: Date;
  schoolDomain: string;
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
      listedAt: post.listedAt,
      schoolDomain: student.schoolDomain,
      thumbKey: image.thumbKey,
    })
    .from(post)
    .innerJoin(student, eq(student.id, post.ownerId))
    .innerJoin(postPhoto, and(eq(postPhoto.postId, post.id), eq(postPhoto.position, 0)))
    .innerJoin(image, eq(image.id, postPhoto.imageId))
    .where(and(inArray(post.status, ["open", "reserved"]), eq(student.accountStatus, "active")))
    .orderBy(desc(post.listedAt), asc(post.id))
    .limit(limit);
}
