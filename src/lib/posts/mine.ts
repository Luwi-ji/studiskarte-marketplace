import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { deal, heart, image, offer, post, postPhoto, postView } from "@/db/schema";
import { getDb } from "@/lib/db";
import { unitsTakenSql } from "@/lib/deals/capacity";

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
  /** How many are available; null when ongoing. */
  quantity: number | null;
  /** Units reserved or handed over. */
  unitsTaken: number;
  /** Offers waiting for the owner to accept or decline. */
  pendingOffers: number;
  /** Offers or reservations are open, so the post cannot be edited. */
  editLocked: boolean;
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
      quantity: post.quantity,
      unitsTaken: unitsTakenSql(post.id),
      editLocked: sql<boolean>`(exists (select 1 from ${deal} where ${deal.postId} = ${post.id} and ${deal.status} in ('agreed', 'scheduled')) or exists (select 1 from ${offer} where ${offer.postId} = ${post.id} and ${offer.status} = 'pending' and ${offer.expiresAt} > now()))`,
      pendingOffers: sql<number>`(select count(*)::int from ${offer} where ${offer.postId} = ${post.id} and ${offer.status} = 'pending' and ${offer.expiresAt} > now())`,
    })
    .from(post)
    .innerJoin(postPhoto, and(eq(postPhoto.postId, post.id), eq(postPhoto.position, 0)))
    .innerJoin(image, eq(image.id, postPhoto.imageId))
    .where(and(eq(post.ownerId, ownerId), isNull(post.ownerDeletedAt)))
    .orderBy(desc(post.listedAt));
}
