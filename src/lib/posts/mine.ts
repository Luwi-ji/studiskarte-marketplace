import { and, desc, eq } from "drizzle-orm";
import { image, post, postPhoto } from "@/db/schema";
import { getDb } from "@/lib/db";

export type OwnPost = {
  id: string;
  kind: string;
  title: string;
  status: string;
  priceKind: string;
  priceAmount: number | null;
  listedAt: Date;
  expiresAt: Date;
  coverThumbKey: string;
};

/** A student's own posts, newest first, with the cover photo. */
export async function listOwnPosts(ownerId: string): Promise<OwnPost[]> {
  return getDb()
    .select({
      id: post.id,
      kind: post.kind,
      title: post.title,
      status: post.status,
      priceKind: post.priceKind,
      priceAmount: post.priceAmount,
      listedAt: post.listedAt,
      expiresAt: post.expiresAt,
      coverThumbKey: image.thumbKey,
    })
    .from(post)
    .innerJoin(postPhoto, and(eq(postPhoto.postId, post.id), eq(postPhoto.position, 0)))
    .innerJoin(image, eq(image.id, postPhoto.imageId))
    .where(eq(post.ownerId, ownerId))
    .orderBy(desc(post.listedAt));
}
