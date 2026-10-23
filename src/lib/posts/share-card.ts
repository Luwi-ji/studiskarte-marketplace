import { and, eq, or } from "drizzle-orm";
import { image, post, postPhoto, school, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { shortSchool } from "@/lib/discovery/cards";
import { visibleToOthers } from "@/lib/discovery/visibility";
import { formatPrice, kindLabel } from "@/lib/posts/format";

/**
 * Everything the share card shows, and nothing else. It is a picture that leaves the app (a story, a
 * chat), so it carries no name, handle, contact detail or meet-up place; the seller is never selected.
 */
export type ShareCard = {
  title: string;
  /** "₱1,200", "Budget ₱500", "Free" or "Negotiable". */
  price: string;
  /** "Showcase" or "Wishlist". */
  kind: string;
  /** The school's abbreviation, or null when the seller has no school. */
  school: string | null;
  /** The first photo's key in the private bucket. */
  photoKey: string;
};

/** A wishlist's amount is a budget; everything else reads as the page does. */
export function sharePrice(kind: string, priceKind: string, priceAmount: number | null): string {
  const price = formatPrice(priceKind, priceAmount);
  return kind === "wishlist" && priceKind === "amount" ? `Budget ${price}` : price;
}

/** Only a live post is worth sharing: open and not past its 30 days, or reserved. */
export function isShareable(status: string, expiresAt: Date, now = new Date()): boolean {
  return status === "reserved" || (status === "open" && expiresAt > now);
}

/**
 * The card for a post the viewer may see, or null (so the route answers 404). The owner may share their
 * own post; others only what the feed would show them. A withdrawn, hidden, removed, expired or
 * fulfilled post is never shared, not even by its owner.
 */
export async function getShareCard(viewerId: string, postId: string): Promise<ShareCard | null> {
  const db = getDb();
  const [row] = await db
    .select({
      kind: post.kind,
      status: post.status,
      title: post.title,
      priceKind: post.priceKind,
      priceAmount: post.priceAmount,
      expiresAt: post.expiresAt,
      schoolName: school.name,
      schoolShort: school.shortName,
    })
    .from(post)
    .innerJoin(student, eq(student.id, post.ownerId))
    .leftJoin(school, eq(school.domain, student.schoolDomain))
    .where(and(eq(post.id, postId), or(eq(post.ownerId, viewerId), visibleToOthers(viewerId))));
  if (!row || !isShareable(row.status, row.expiresAt)) return null;

  const [photo] = await db
    .select({ key: image.key })
    .from(postPhoto)
    .innerJoin(image, eq(image.id, postPhoto.imageId))
    .where(eq(postPhoto.postId, postId))
    .orderBy(postPhoto.position)
    .limit(1);
  // A post always has a photo (the database refuses one without), so a missing row means it is gone.
  if (!photo) return null;

  return {
    title: row.title,
    price: sharePrice(row.kind, row.priceKind, row.priceAmount),
    kind: kindLabel(row.kind),
    school: row.schoolName ? shortSchool(row.schoolName, row.schoolShort) : null,
    photoKey: photo.key,
  };
}
