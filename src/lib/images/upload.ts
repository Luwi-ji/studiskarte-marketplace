import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { image } from "@/db/schema";
import { getDb } from "@/lib/db";
import { consume } from "@/lib/rate-limit";
import { processImage, type ImageShape } from "@/lib/images/process";
import type { ObjectStore } from "@/lib/images/store";

const UPLOADS_PER_STUDENT = { max: 30, windowSeconds: 60 * 60 };

export class UploadLimitError extends Error {
  constructor() {
    super("too many uploads");
    this.name = "UploadLimitError";
  }
}

export type StoredImage = { id: string; keys: [string, string] };

export type ImagePurpose = "post_photo" | "avatar" | "message_photo";
const LAYOUT: Record<ImagePurpose, { folder: string; shape: ImageShape }> = {
  post_photo: { folder: "posts", shape: "photo" },
  avatar: { folder: "avatars", shape: "avatar" },
  message_photo: { folder: "messages", shape: "photo" },
};

/**
 * Validates, re-encodes (dropping location data) and stores one image.
 * On any failure nothing is left behind: no object, no `image` row.
 */
export async function storeImage(args: {
  ownerId: string;
  bytes: Buffer;
  purpose: ImagePurpose;
  store: ObjectStore;
}): Promise<StoredImage> {
  const { ownerId, bytes, purpose, store } = args;
  if (!(await consume({ action: "upload", key: ownerId, ...UPLOADS_PER_STUDENT }))) {
    throw new UploadLimitError();
  }

  const { folder, shape } = LAYOUT[purpose];
  const processed = await processImage(bytes, shape);
  const name = randomUUID();
  const key = `${folder}/${ownerId}/${name}.webp`;
  const thumbKey = `${folder}/${ownerId}/${name}-thumb.webp`;

  try {
    await store.put(key, processed.main, "image/webp");
    await store.put(thumbKey, processed.thumb, "image/webp");
    const [row] = await getDb()
      .insert(image)
      .values({
        ownerId,
        purpose,
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

/** Removes an image that is no longer used (a failed post, a replaced profile picture). */
export async function discardImage(stored: StoredImage, store: ObjectStore): Promise<void> {
  await getDb().delete(image).where(eq(image.id, stored.id));
  await store.delete(stored.keys);
}
