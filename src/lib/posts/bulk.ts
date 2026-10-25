import type { ObjectStore } from "@/lib/images/store";
import { CONDITIONS, OPEN_POSTS_MAX, PRICE_KINDS, type PostFields } from "@/lib/posts/schema";
import type { BulkAction } from "@/lib/posts/own-view";
import { SHOWCASE_NEEDS_ID_AFTER_SALE, SHOWCASE_NEEDS_ID_CHECK } from "@/lib/posts/showcase-limit";
import { deletePost, withdrawPost } from "@/lib/posts/transitions";
import { getEditablePost, updatePost, type EditablePost } from "@/lib/posts/update";

/** At most this many posts in one go; a student has at most 20 open, and the rest are old ones being cleared. */
export const BULK_MAX = 100;

/** One post's outcome. A failure's `reason` is a short phrase that reads after "could not be changed:". */
export type BulkResult = { id: string; ok: true } | { id: string; ok: false; reason: string };

const REASON = {
  notAllowed: {
    relist: "only expired posts can be relisted",
    withdraw: "only open or reserved posts can be withdrawn",
    delete: "only expired or withdrawn posts can be deleted",
  },
  reservation: "a reservation is still being carried out",
  limit: `you have ${OPEN_POSTS_MAX} open posts`,
  idCheck: "an ID check is needed to post more showcases",
  needsChanges: "its details need a change first, so open it and relist from there",
  duplicate: "you already have an open post with the same title and description",
} as const;

/** What the post form would send for this post: the same values the edit page starts from. */
function relistFields(editable: EditablePost): PostFields {
  const { post: row, photos, availability } = editable;
  return {
    title: row.title,
    description: row.description,
    categoryId: row.categoryId,
    condition: CONDITIONS.find((value) => value === row.condition) ?? null,
    priceKind: PRICE_KINDS.find((value) => value === row.priceKind) ?? "negotiable",
    priceAmount: row.priceAmount === null ? "" : String(row.priceAmount),
    quantity: row.quantity === null ? "1" : String(row.quantity),
    unlimited: row.quantity === null,
    exchangeMeetup: row.exchangeMeetup,
    exchangeDelivery: row.exchangeDelivery,
    meetupLocation: row.meetupLocation ?? "",
    paymentCash: row.paymentCash,
    paymentOnline: row.paymentOnline,
    paymentOther: row.paymentOther,
    paymentNote: row.paymentNote ?? "",
    allowNonStudents: row.allowNonStudents,
    availability,
    photos: photos.map((photo) => ({ id: photo.id, caption: photo.caption ?? "" })),
  };
}

async function relistOne(ownerId: string, id: string, store: ObjectStore, now: Date): Promise<BulkResult> {
  const editable = await getEditablePost(ownerId, id, now);
  if (!editable || !editable.relist) return { id, ok: false, reason: REASON.notAllowed.relist };
  // The same function, with the same checks, as relisting one post from its edit page.
  const result = await updatePost({ ownerId, postId: id, input: relistFields(editable), store, relist: true, now });
  if (result.ok) return { id, ok: true };
  const form = result.errors.form;
  if (form === SHOWCASE_NEEDS_ID_CHECK || form === SHOWCASE_NEEDS_ID_AFTER_SALE) return { id, ok: false, reason: REASON.idCheck };
  if (form?.includes("open posts")) return { id, ok: false, reason: REASON.limit };
  if (form?.includes("already have an open post")) return { id, ok: false, reason: REASON.duplicate };
  if (form?.includes("expired")) return { id, ok: false, reason: REASON.notAllowed.relist };
  return { id, ok: false, reason: REASON.needsChanges };
}

/**
 * Relists, withdraws or deletes several of a student's own posts, one at a time, through the same functions the
 * single-post actions use, so every rule (ownership, status, reservations, the open-post limit) holds for each
 * post. One post failing never stops the others: every post gets its own result, in the order given.
 */
export async function changePosts(args: { ownerId: string; action: BulkAction; ids: string[]; store: ObjectStore; now?: Date }): Promise<BulkResult[]> {
  const now = args.now ?? new Date();
  const ids = [...new Set(args.ids)].slice(0, BULK_MAX);
  const results: BulkResult[] = [];
  for (const id of ids) {
    try {
      if (args.action === "relist") {
        results.push(await relistOne(args.ownerId, id, args.store, now));
        continue;
      }
      const outcome = args.action === "withdraw" ? await withdrawPost(args.ownerId, id) : await deletePost(args.ownerId, id);
      results.push(
        outcome === "ok"
          ? { id, ok: true }
          : { id, ok: false, reason: outcome === "has_reservations" ? REASON.reservation : REASON.notAllowed[args.action] },
      );
    } catch (error) {
      // An unexpected failure (database, storage) must not stop the others or vanish: one searchable line, no message text or personal data.
      console.error(JSON.stringify({ event: "bulk_post_failed", action: args.action, postId: id, error: error instanceof Error ? error.name : "unknown", code: (error as { code?: string })?.code }));
      results.push({ id, ok: false, reason: "Something went wrong on our side. Try again in a moment." });
    }
  }
  return results;
}
