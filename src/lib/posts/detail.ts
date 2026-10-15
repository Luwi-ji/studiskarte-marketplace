import { and, eq, inArray, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { category, image, post, postPhoto, school, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { loadAvailability } from "@/lib/posts/availability";
import type { Availability } from "@/lib/posts/schema";

/** Everything the post page shows. The seller's email is never selected. */
export type PostDetail = {
  id: string;
  kind: string;
  status: string;
  title: string;
  description: string;
  categoryName: string;
  mainCategoryId: string;
  mainCategoryName: string;
  condition: string | null;
  priceKind: string;
  priceAmount: number | null;
  exchangeMeetup: boolean;
  exchangeDelivery: boolean;
  meetupLocation: string | null;
  deliveryArea: string | null;
  listedAt: Date;
  expiresAt: Date;
  isOwner: boolean;
  seller: { handle: string | null; displayName: string; school: string; avatarThumbKey: string | null };
  photos: { key: string; width: number; height: number }[];
  availability: Availability[];
};

const mainCategory = alias(category, "main_category");
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
      categoryName: category.name,
      mainCategoryId: mainCategory.id,
      mainCategoryName: mainCategory.name,
      condition: post.condition,
      priceKind: post.priceKind,
      priceAmount: post.priceAmount,
      exchangeMeetup: post.exchangeMeetup,
      exchangeDelivery: post.exchangeDelivery,
      meetupLocation: post.meetupLocation,
      deliveryArea: post.deliveryArea,
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
    .innerJoin(mainCategory, eq(mainCategory.id, category.parentId))
    .innerJoin(student, eq(student.id, post.ownerId))
    .innerJoin(school, eq(school.domain, student.schoolDomain))
    .leftJoin(avatar, eq(avatar.id, student.avatarImageId))
    .where(
      and(
        eq(post.id, postId),
        or(
          eq(post.ownerId, viewerId),
          and(inArray(post.status, ["open", "reserved"]), eq(student.accountStatus, "active")),
        ),
      ),
    );
  if (!row) return null;

  const [photos, availability] = await Promise.all([
    db
      .select({ key: image.key, width: image.width, height: image.height })
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
    categoryName: row.categoryName,
    mainCategoryId: row.mainCategoryId,
    mainCategoryName: row.mainCategoryName,
    condition: row.condition,
    priceKind: row.priceKind,
    priceAmount: row.priceAmount,
    exchangeMeetup: row.exchangeMeetup,
    exchangeDelivery: row.exchangeDelivery,
    meetupLocation: row.meetupLocation,
    deliveryArea: row.deliveryArea,
    listedAt: row.listedAt,
    expiresAt: row.expiresAt,
    isOwner: row.ownerId === viewerId,
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
