import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { image } from "@/db/schema";
import { getDb } from "@/lib/db";
import { consume } from "@/lib/rate-limit";
import { processImage } from "@/lib/images/process";
import type { ObjectStore } from "@/lib/images/store";

const UPLOADS_PER_STUDENT = { max: 30, windowSeconds: 60 * 60 };

export class UploadLimitError extends Error {
  constructor() {
    super("too many uploads");
    this.name = "UploadLimitError";
  }
}

export type StoredImage = { id: string; keys: [string, string] };

/**
 * Validates, re-encodes (dropping location data) and stores one post photo.
 * On any failure nothing is left behind: no object, no `image` row.
 */
export async function storePostPhoto(args: {
  ownerId: string;
  bytes: Buffer;
  store: ObjectStore;
}): Promise<StoredImage> {
  const { ownerId, bytes, store } = args;
  if (!(await consume({ action: "upload", key: ownerId, ...UPLOADS_PER_STUDENT }))) {
    throw new UploadLimitError();
  }

  const processed = await processImage(bytes);
  const name = randomUUID();
  const key = `posts/${ownerId}/${name}.webp`;
  const thumbKey = `posts/${ownerId}/${name}-thumb.webp`;

  try {
    await store.put(key, processed.main, "image/webp");
    await store.put(thumbKey, processed.thumb, "image/webp");
    const [row] = await getDb()
      .insert(image)
      .values({
        ownerId,
        purpose: "post_photo",
        key,
        thumbKey,
        width: processed.width,
        height: processed.height,
        bytes: processed.main.length,
      })
      .returning({ id: image.id });
    return { id: row.id, keys: [key, thumbKey] };
  } catch (error) {
    await store.delete([key, thumbKey]).catch((cleanupError) => {
      console.error("could not remove objects after a failed upload", cleanupError);
    });
    throw error;
  }
}

/** Removes an image that never became part of a post. */
export async function discardImage(stored: StoredImage, store: ObjectStore): Promise<void> {
  await getDb().delete(image).where(eq(image.id, stored.id));
  await store.delete(stored.keys);
}
