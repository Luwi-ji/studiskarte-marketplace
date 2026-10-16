import { and, desc, eq, sql } from "drizzle-orm";
import { conversation, heart, image, offer, post, postPhoto, postView } from "@/db/schema";
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
  viewCount: number;
  /** How many students hearted it, never who. */
  heartCount: number;
  /** Offers waiting for the owner to accept or decline. */
  pendingOffers: number;
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
      viewCount: sql<number>`(select count(*)::int from ${postView} where ${postView.postId} = ${post.id})`,
      heartCount: sql<number>`(select count(*)::int from ${heart} where ${heart.postId} = ${post.id})`,
      pendingOffers: sql<number>`(select count(*)::int from ${offer} join ${conversation} on ${conversation.id} = ${offer.conversationId} where ${conversation.postId} = ${post.id} and ${offer.status} = 'pending' and ${offer.expiresAt} > now())`,
    })
    .from(post)
    .innerJoin(postPhoto, and(eq(postPhoto.postId, post.id), eq(postPhoto.position, 0)))
    .innerJoin(image, eq(image.id, postPhoto.imageId))
    .where(eq(post.ownerId, ownerId))
    .orderBy(desc(post.listedAt));
}
