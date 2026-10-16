import { and, eq, lt, notExists } from "drizzle-orm";
import { image, postPhoto } from "@/db/schema";
import { getDb } from "@/lib/db";
import type { ObjectStore } from "@/lib/images/store";

/** A photo must be this old before it counts as abandoned, so one being uploaded is never removed. */
export const UNUSED_PHOTO_HOURS = 24;

/**
 * Deletes post photos that were uploaded but never became part of a post
 * (abandoned or refused forms), from the database and from storage.
 * Profile pictures are not touched. Safe to run twice.
 */
export async function cleanupUnusedPhotos(store: ObjectStore, now = new Date()): Promise<number> {
  const db = getDb();
  const cutoff = new Date(now.getTime() - UNUSED_PHOTO_HOURS * 60 * 60 * 1000);
  // Rows first, with the "not on a post" test inside the delete itself: a photo
  // attached in the meantime is kept (and the foreign key would refuse anyway),
  // so a file is only removed for a row that is really gone.
  const removed = await db
    .delete(image)
    .where(
      and(
        eq(image.purpose, "post_photo"),
        lt(image.createdAt, cutoff),
        notExists(db.select({ one: postPhoto.imageId }).from(postPhoto).where(eq(postPhoto.imageId, image.id))),
      ),
    )
    .returning({ key: image.key, thumbKey: image.thumbKey });
  if (removed.length === 0) return 0;
  await store.delete(removed.flatMap((row) => [row.key, row.thumbKey]));
  return removed.length;
}
