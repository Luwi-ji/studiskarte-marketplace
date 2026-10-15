import { post, postPhoto } from "@/db/schema";
import { getDb } from "@/lib/db";
import { discardImage, storePostPhoto } from "@/lib/images/upload";
import type { ObjectStore } from "@/lib/images/store";
import { newPostSchema } from "@/lib/posts/schema";

/**
 * Creates a post with its photo. The photo is stored first; the post and the
 * link to the photo are written in one transaction. If anything fails, the
 * photo is removed again, so a failed attempt leaves nothing behind.
 */
export async function createPost(args: {
  ownerId: string;
  input: unknown;
  photo: Buffer;
  store: ObjectStore;
}): Promise<{ id: string }> {
  const input = newPostSchema.parse(args.input);
  const stored = await storePostPhoto({
    ownerId: args.ownerId,
    bytes: args.photo,
    store: args.store,
  });

  try {
    return await getDb().transaction(async (tx) => {
      const [created] = await tx
        .insert(post)
        .values({ ownerId: args.ownerId, kind: input.kind, title: input.title })
        .returning({ id: post.id });
      await tx.insert(postPhoto).values({ postId: created.id, imageId: stored.id, position: 0 });
      return created;
    });
  } catch (error) {
    await discardImage(stored, args.store).catch((cleanupError) => {
      console.error("could not remove photo after a failed post", cleanupError);
    });
    throw error;
  }
}
