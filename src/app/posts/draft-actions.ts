"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { image, postPhoto } from "@/db/schema";
import { requireActiveStudent } from "@/lib/access";
import { getDb } from "@/lib/db";
import { getObjectStore } from "@/lib/images/store";
import { PHOTOS_MAX } from "@/lib/posts/schema";

const PREVIEW_LINK_SECONDS = 60 * 60;
const photoIdsSchema = z.array(z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)).max(PHOTOS_MAX);

/**
 * For a saved draft: which of its photos can still be used, each with a fresh picture link (the saved one runs out after
 * an hour). A photo that is gone, is not the student's own, or is already on a post is left out.
 */
export async function checkDraftPhotosAction(photoIds: unknown): Promise<{ id: string; thumbUrl: string }[]> {
  const me = await requireActiveStudent();
  const ids = photoIdsSchema.safeParse(photoIds);
  if (!ids.success || ids.data.length === 0) return [];
  const rows = await getDb()
    .select({ id: image.id, thumbKey: image.thumbKey, onPost: postPhoto.postId })
    .from(image)
    .leftJoin(postPhoto, eq(postPhoto.imageId, image.id))
    .where(and(inArray(image.id, ids.data), eq(image.ownerId, me.id), eq(image.purpose, "post_photo")));
  const store = getObjectStore();
  return Promise.all(
    rows.filter((row) => row.onPost === null).map(async (row) => ({ id: row.id, thumbUrl: await store.signedUrl(row.thumbKey, PREVIEW_LINK_SECONDS) })),
  );
}
