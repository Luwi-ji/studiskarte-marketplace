import { and, count, eq, inArray } from "drizzle-orm";
import { availabilityWindow, image, post, postPhoto, student } from "@/db/schema";
import { getDb, type DbTransaction } from "@/lib/db";
import { categoryLookup, listCategories } from "@/lib/posts/categories";
import { OPEN_POSTS_MAX, parseNewPost, type FieldErrors, type PostData } from "@/lib/posts/schema";

export type SaveResult = { ok: true; id: string } | { ok: false; errors: FieldErrors };

/** Every photo must be the owner's own post photo and not on another post. */
export async function checkPhotos(tx: DbTransaction, ownerId: string, photoIds: string[], postId: string | null) {
  const rows = await tx
    .select({ id: image.id, onPost: postPhoto.postId })
    .from(image)
    .leftJoin(postPhoto, eq(postPhoto.imageId, image.id))
    .where(and(inArray(image.id, photoIds), eq(image.ownerId, ownerId), eq(image.purpose, "post_photo")));
  const usable = rows.filter((row) => row.onPost === null || row.onPost === postId);
  return usable.length === photoIds.length;
}

export async function writeDetails(tx: DbTransaction, postId: string, data: PostData) {
  await tx
    .insert(postPhoto)
    .values(data.photos.map((photo, position) => ({ postId, imageId: photo.id, position, caption: photo.caption })));
  await tx.insert(availabilityWindow).values(
    data.availability.map((entry) =>
      entry.kind === "weekly"
        ? { postId, kind: "weekly", weekday: entry.weekday, startTime: entry.startTime, endTime: entry.endTime }
        : { postId, kind: "date", onDate: entry.date, startTime: entry.startTime, endTime: entry.endTime },
    ),
  );
}

export function postColumns(data: PostData) {
  return {
    title: data.title,
    description: data.description,
    categoryId: data.categoryId,
    condition: data.condition,
    priceKind: data.priceKind,
    priceAmount: data.priceAmount,
    quantity: data.quantity,
    exchangeMeetup: data.exchangeMeetup,
    exchangeDelivery: data.exchangeDelivery,
    meetupLocation: data.meetupLocation,
    paymentCash: data.paymentCash,
    paymentOnline: data.paymentOnline,
    paymentOther: data.paymentOther,
    paymentNote: data.paymentNote,
  };
}

// Drizzle wraps the Postgres error in `cause`; narrow it instead of assuming its shape.
export function isDuplicatePost(error: unknown): boolean {
  if (!(error instanceof Error) || !error.cause || typeof error.cause !== "object") return false;
  const cause = error.cause;
  return "code" in cause && cause.code === "23505" && "constraint" in cause && cause.constraint === "post_open_duplicate";
}

export const DUPLICATE_POST: SaveResult = {
  ok: false,
  errors: { form: "You already have an open post with this title and description." },
};

/**
 * Creates a post from photos already uploaded (see images/upload.ts). The
 * post, its photos and its availability are written in one transaction, so a
 * failure leaves nothing behind.
 */
export async function createPost(args: { ownerId: string; input: unknown; now?: Date }): Promise<SaveResult> {
  const parsed = parseNewPost(args.input, categoryLookup(await listCategories()), args.now);
  if (!parsed.ok) return parsed;
  const data = parsed.data;

  try {
    return await getDb().transaction(async (tx) => {
      // One create at a time per student, so two at once cannot both slip under the limit.
      const [me] = await tx.select({ status: student.accountStatus }).from(student).where(eq(student.id, args.ownerId)).for("update");
      if (!me || me.status === "deleted") return { ok: false, errors: { form: "Your account can't post." } };
      const [{ open }] = await tx
        .select({ open: count() })
        .from(post)
        .where(and(eq(post.ownerId, args.ownerId), eq(post.status, "open")));
      if (open >= OPEN_POSTS_MAX) {
        return { ok: false, errors: { form: `You can have at most ${OPEN_POSTS_MAX} open posts. Withdraw one first.` } };
      }
      if (!(await checkPhotos(tx, args.ownerId, data.photos.map((p) => p.id), null))) {
        return { ok: false, errors: { photos: "A photo is missing. Upload it again." } };
      }
      const [created] = await tx
        .insert(post)
        .values({ ownerId: args.ownerId, kind: data.kind, ...postColumns(data) })
        .returning({ id: post.id });
      await writeDetails(tx, created.id, data);
      return { ok: true, id: created.id };
    });
  } catch (error) {
    if (isDuplicatePost(error)) return DUPLICATE_POST;
    throw error;
  }
}

