import { and, count, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { availabilityWindow, image, post, postPhoto, student } from "@/db/schema";
import { getDb } from "@/lib/db";
import { syncAvailability, unitsTaken } from "@/lib/deals/capacity";
import { EDIT_LOCKED, editLockReason } from "@/lib/deals/count";
import type { ObjectStore } from "@/lib/images/store";
import { discardImage } from "@/lib/images/upload";
import { loadAvailability } from "@/lib/posts/availability";
import { categoryLookup, listCategories } from "@/lib/posts/categories";
import {
  checkPhotos,
  DUPLICATE_POST,
  isDuplicatePost,
  postColumns,
  writeDetails,
  type SaveResult,
} from "@/lib/posts/create";
import { manilaToday, OPEN_POSTS_MAX, parsePostEdit, type Availability } from "@/lib/posts/schema";

/** A listing lasts 30 days from when it is listed (or relisted). */
export const LISTING_DAYS = 30;

const NOT_EDITABLE: SaveResult = { ok: false, errors: { form: "Only your own open or reserved posts can be edited." } };
const NOT_RELISTABLE: SaveResult = { ok: false, errors: { form: "Only your own expired posts can be relisted." } };

/**
 * Edits an open post the student owns, or (relist: true) relists an expired
 * one. Photos and availability are replaced as given; photos taken off the post
 * are deleted from storage after the change is saved. The kind never changes.
 * Relisting also starts a new 30 days and a new listed date, and counts
 * against the open-post limit like a new post.
 */
export async function updatePost(args: {
  ownerId: string;
  postId: string;
  input: unknown;
  store: ObjectStore;
  relist?: boolean;
  now?: Date;
}): Promise<SaveResult> {
  const now = args.now ?? new Date();
  const parsed = parsePostEdit(args.input, categoryLookup(await listCategories()), now);
  if (!parsed.ok) return parsed;
  const data = parsed.data;
  const relist = args.relist === true;

  let removed: { id: string; key: string; thumbKey: string }[];
  let takenUnits = 0;
  try {
    const outcome = await getDb().transaction(async (tx) => {
      // Relisting adds an open post, so serialize with other creates and relists of this student.
      if (relist) await tx.select({ id: student.id }).from(student).where(eq(student.id, args.ownerId)).for("update");
      const [current] = await tx
        .select({ id: post.id })
        .from(post)
        .where(and(eq(post.id, args.postId), eq(post.ownerId, args.ownerId), isNull(post.ownerDeletedAt), inArray(post.status, relist ? ["expired"] : ["open", "reserved"])))
        .for("update");
      if (!current) return null;
      // A change under someone's offer or reservation would surprise them: decline or cancel first.
      if (!relist && (await editLockReason(args.postId))) return "locked" as const;
      if (relist) {
        const [{ open }] = await tx
          .select({ open: count() })
          .from(post)
          .where(and(eq(post.ownerId, args.ownerId), eq(post.status, "open")));
        if (open >= OPEN_POSTS_MAX) return "limit" as const;
      }
      const photoIds = data.photos.map((p) => p.id);
      if (!(await checkPhotos(tx, args.ownerId, photoIds, args.postId))) return "photos" as const;
      // Units already reserved or handed over cannot be taken back by lowering the quantity.
      const taken = await unitsTaken(tx, args.postId);
      if (data.quantity !== null && data.quantity < taken) {
        takenUnits = taken;
        return "quantity" as const;
      }

      const dropped = await tx
        .select({ id: image.id, key: image.key, thumbKey: image.thumbKey })
        .from(postPhoto)
        .innerJoin(image, eq(image.id, postPhoto.imageId))
        .where(and(eq(postPhoto.postId, args.postId), notInArray(postPhoto.imageId, photoIds)));

      await tx
        .update(post)
        .set({
          ...postColumns(data),
          updatedAt: now,
          ...(relist
            ? {
                status: "open",
                listedAt: now,
                expiresAt: new Date(now.getTime() + LISTING_DAYS * 24 * 60 * 60 * 1000),
              }
            : {}),
        })
        .where(eq(post.id, args.postId));
      // Replace photos and times; the "at least one" triggers check at commit.
      await tx.delete(postPhoto).where(eq(postPhoto.postId, args.postId));
      await tx.delete(availabilityWindow).where(eq(availabilityWindow.postId, args.postId));
      await writeDetails(tx, args.postId, data);
      // A raised quantity can make a fully reserved post Active again (and a lowered one the reverse).
      if (!relist) await syncAvailability(tx, args.postId, now);
      return dropped;
    });
    if (outcome === null) return relist ? NOT_RELISTABLE : NOT_EDITABLE;
    if (outcome === "locked") return { ok: false, errors: { form: EDIT_LOCKED } };
    if (outcome === "photos") return { ok: false, errors: { photos: "A photo is missing. Upload it again." } };
    if (outcome === "quantity") {
      return { ok: false, errors: { quantity: `${takenUnits} already reserved, so the quantity cannot go below ${takenUnits}.` } };
    }
    if (outcome === "limit") {
      return { ok: false, errors: { form: `You can have at most ${OPEN_POSTS_MAX} open posts. Withdraw one first.` } };
    }
    removed = outcome;
  } catch (error) {
    if (isDuplicatePost(error)) return DUPLICATE_POST;
    throw error;
  }

  // The change is saved; a failed cleanup only leaves unused files behind.
  for (const photo of removed) {
    await discardImage({ id: photo.id, keys: [photo.key, photo.thumbKey] }, args.store).catch((error) => {
      console.error("could not remove a photo taken off a post", error);
    });
  }
  return { ok: true, id: args.postId };
}

/** What the edit form starts from. */
export type EditablePost = {
  post: typeof post.$inferSelect;
  photos: { id: string; thumbKey: string; caption: string | null }[];
  availability: Availability[];
  /** True for an expired post: saving relists it. */
  relist: boolean;
  /** Why it cannot be edited now (offers or reservations), or null. */
  lockedReason: string | null;
};

/**
 * The data an owner needs to edit an open post or relist an expired one, or
 * null if it is not theirs or in neither state. For an expired post, dates
 * that have passed are left out so the form starts valid.
 */
export async function getEditablePost(ownerId: string, postId: string, now = new Date()): Promise<EditablePost | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(post)
    .where(and(eq(post.id, postId), eq(post.ownerId, ownerId), isNull(post.ownerDeletedAt)));
  if (!row || (row.status !== "open" && row.status !== "reserved" && row.status !== "expired")) return null;
  const photos = await db
    .select({ id: image.id, thumbKey: image.thumbKey, caption: postPhoto.caption })
    .from(postPhoto)
    .innerJoin(image, eq(image.id, postPhoto.imageId))
    .where(eq(postPhoto.postId, postId))
    .orderBy(postPhoto.position);
  const relist = row.status === "expired";
  const today = manilaToday(now);
  const availability = (await loadAvailability(postId)).filter((a) => !relist || a.kind === "weekly" || a.date >= today);
  return { post: row, photos, availability, relist, lockedReason: relist ? null : await editLockReason(postId) };
}
