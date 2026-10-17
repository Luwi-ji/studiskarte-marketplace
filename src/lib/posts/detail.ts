import { and, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { category, image, post, postPhoto, school, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { loadAvailability } from "@/lib/posts/availability";
import { unitsTaken } from "@/lib/deals/capacity";
import { countPendingOffers, editLockReason, findMyTransaction, hasActiveReservation, type MyTransaction } from "@/lib/deals/count";
import { countViews } from "@/lib/posts/views";
import { countHearts, hasHearted } from "@/lib/social/heart";
import { visibleToOthers } from "@/lib/discovery/visibility";
import { paymentModesOf, type PaymentMode } from "@/lib/payment";
import type { Availability } from "@/lib/posts/schema";

/** Everything the post page shows. The seller's email is never selected. */
export type PostDetail = {
  id: string;
  kind: string;
  status: string;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  condition: string | null;
  priceKind: string;
  priceAmount: number | null;
  exchangeMeetup: boolean;
  exchangeDelivery: boolean;
  meetupLocation: string | null;
  deliveryArea: string | null;
  /** How payment is made (none for a free post). The note is only for the people in a reservation. */
  paymentModes: PaymentMode[];
  listedAt: Date;
  expiresAt: Date;
  isOwner: boolean;
  /** Distinct student-days that opened the post. Null unless the viewer is the owner. */
  viewCount: number | null;
  /** How many students hearted the post, never who. Null unless the viewer is the owner. */
  heartCount: number | null;
  /** How many are available; null when ongoing (no limit). */
  quantity: number | null;
  /** Units reserved or handed over. */
  unitsTaken: number;
  /** The viewer's own offer or reservation on this post, waiting or accepted. Null for the owner. */
  myTransaction: MyTransaction | null;
  /** The viewer already has a reservation here (so no further offers). Always false for the owner. */
  hasReservation: boolean;
  /** The owner cannot edit while offers or reservations are open. False for everyone else. */
  editLocked: boolean;
  /** Offers waiting for a decision. Null unless the viewer is the owner. */
  pendingOffers: number | null;
  /** Whether the viewer hearted it. Always false for the owner. */
  hearted: boolean;
  seller: { handle: string | null; displayName: string; school: string; avatarThumbKey: string | null };
  photos: { key: string; width: number; height: number; caption: string | null }[];
  availability: Availability[];
};

const avatar = alias(image, "avatar");

/**
 * A post as the viewer may see it, or null. Others see a post only while it
 * is open or reserved and its owner's account is active; the owner always
 * sees their own.
 */
export async function getPostDetail(viewerId: string, postId: string): Promise<PostDetail | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: post.id,
      kind: post.kind,
      status: post.status,
      title: post.title,
      description: post.description,
      categoryId: category.id,
      categoryName: category.name,
      condition: post.condition,
      priceKind: post.priceKind,
      priceAmount: post.priceAmount,
      exchangeMeetup: post.exchangeMeetup,
      exchangeDelivery: post.exchangeDelivery,
      meetupLocation: post.meetupLocation,
      deliveryArea: post.deliveryArea,
      paymentCash: post.paymentCash,
      paymentOnline: post.paymentOnline,
      paymentOther: post.paymentOther,
      quantity: post.quantity,
      listedAt: post.listedAt,
      expiresAt: post.expiresAt,
      ownerId: post.ownerId,
      sellerHandle: student.handle,
      sellerName: student.name,
      schoolName: school.name,
      schoolDomain: school.domain,
      avatarThumbKey: avatar.thumbKey,
    })
    .from(post)
    .innerJoin(category, eq(category.id, post.categoryId))
    .innerJoin(student, eq(student.id, post.ownerId))
    .innerJoin(school, eq(school.domain, student.schoolDomain))
    .leftJoin(avatar, eq(avatar.id, student.avatarImageId))
    .where(
      and(
        eq(post.id, postId),
        or(
          eq(post.ownerId, viewerId),
          visibleToOthers(),
        ),
      ),
    );
  if (!row) return null;

  const [photos, availability] = await Promise.all([
    db
      .select({ key: image.key, width: image.width, height: image.height, caption: postPhoto.caption })
      .from(postPhoto)
      .innerJoin(image, eq(image.id, postPhoto.imageId))
      .where(eq(postPhoto.postId, postId))
      .orderBy(postPhoto.position),
    loadAvailability(postId),
  ]);

  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    title: row.title,
    description: row.description,
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    condition: row.condition,
    priceKind: row.priceKind,
    priceAmount: row.priceAmount,
    exchangeMeetup: row.exchangeMeetup,
    exchangeDelivery: row.exchangeDelivery,
    meetupLocation: row.meetupLocation,
    deliveryArea: row.deliveryArea,
    paymentModes: paymentModesOf(row),
    listedAt: row.listedAt,
    expiresAt: row.expiresAt,
    isOwner: row.ownerId === viewerId,
    viewCount: row.ownerId === viewerId ? await countViews(postId) : null,
    heartCount: row.ownerId === viewerId ? await countHearts(postId) : null,
    editLocked: row.ownerId === viewerId ? (await editLockReason(postId)) !== null : false,
    quantity: row.quantity,
    unitsTaken: await unitsTaken(db, postId),
    myTransaction: row.ownerId === viewerId ? null : await findMyTransaction(viewerId, postId),
    hasReservation: row.ownerId === viewerId ? false : await hasActiveReservation(viewerId, postId),
    pendingOffers: row.ownerId === viewerId ? await countPendingOffers(postId) : null,
    hearted: row.ownerId === viewerId ? false : await hasHearted(viewerId, postId),
    seller: {
      handle: row.sellerHandle,
      displayName: row.sellerName,
      school: row.schoolName ?? row.schoolDomain,
      avatarThumbKey: row.avatarThumbKey,
    },
    photos,
    availability,
  };
}

