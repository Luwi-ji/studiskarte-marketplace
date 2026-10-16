import { and, eq, notInArray } from "drizzle-orm";
import { availabilityWindow, image, post, postPhoto } from "@/db/schema";
import { loadAvailability } from "@/lib/posts/availability";
import { getDb } from "@/lib/db";
import type { ObjectStore } from "@/lib/images/store";
import { discardImage } from "@/lib/images/upload";
import { categoryLookup, listCategories } from "@/lib/posts/categories";
import {
  checkPhotos,
  DUPLICATE_POST,
  isDuplicatePost,
  postColumns,
  writeDetails,
  type SaveResult,
} from "@/lib/posts/create";
import { parsePostEdit, type Availability } from "@/lib/posts/schema";

const NOT_EDITABLE: SaveResult = { ok: false, errors: { form: "Only your own open posts can be edited." } };

/**
 * Edits an open post the student owns. Photos and availability are replaced
 * as given. Photos taken off the post are deleted from storage after the edit
 * is saved. The kind never changes.
 */
export async function updatePost(args: {
  ownerId: string;
  postId: string;
  input: unknown;
  store: ObjectStore;
  now?: Date;
}): Promise<SaveResult> {
  const parsed = parsePostEdit(args.input, categoryLookup(await listCategories()), args.now);
  if (!parsed.ok) return parsed;
  const data = parsed.data;

  let removed: { id: string; key: string; thumbKey: string }[];
  try {
    const outcome = await getDb().transaction(async (tx) => {
      const [current] = await tx
        .select({ id: post.id })
        .from(post)
        .where(and(eq(post.id, args.postId), eq(post.ownerId, args.ownerId), eq(post.status, "open")))
        .for("update");
      if (!current) return null;
      const photoIds = data.photos.map((p) => p.id);
      if (!(await checkPhotos(tx, args.ownerId, photoIds, args.postId))) return "photos" as const;

      const dropped = await tx
        .select({ id: image.id, key: image.key, thumbKey: image.thumbKey })
        .from(postPhoto)
        .innerJoin(image, eq(image.id, postPhoto.imageId))
        .where(and(eq(postPhoto.postId, args.postId), notInArray(postPhoto.imageId, photoIds)));

      await tx
        .update(post)
        .set({ ...postColumns(data), updatedAt: new Date() })
        .where(eq(post.id, args.postId));
      // Replace photos and times; the "at least one" triggers check at commit.
      await tx.delete(postPhoto).where(eq(postPhoto.postId, args.postId));
      await tx.delete(availabilityWindow).where(eq(availabilityWindow.postId, args.postId));
      await writeDetails(tx, args.postId, data);
      return dropped;
    });
    if (outcome === null) return NOT_EDITABLE;
    if (outcome === "photos") return { ok: false, errors: { photos: "A photo is missing. Upload it again." } };
    removed = outcome;
  } catch (error) {
    if (isDuplicatePost(error)) return DUPLICATE_POST;
    throw error;
  }

  // The edit is saved; a failed cleanup only leaves unused files behind.
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
};

/** The data an owner needs to edit a post, or null if it is not theirs or not open. */
export async function getEditablePost(ownerId: string, postId: string): Promise<EditablePost | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(post)
    .where(and(eq(post.id, postId), eq(post.ownerId, ownerId), eq(post.status, "open")));
  if (!row) return null;
  const photos = await db
    .select({ id: image.id, thumbKey: image.thumbKey, caption: postPhoto.caption })
    .from(postPhoto)
    .innerJoin(image, eq(image.id, postPhoto.imageId))
    .where(eq(postPhoto.postId, postId))
    .orderBy(postPhoto.position);
  return { post: row, photos, availability: await loadAvailability(postId) };
}
