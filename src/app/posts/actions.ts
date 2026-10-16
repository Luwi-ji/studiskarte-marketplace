"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireActiveStudent } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { createPost, type SaveResult } from "@/lib/posts/create";
import { withdrawPost } from "@/lib/posts/transitions";
import { updatePost } from "@/lib/posts/update";
import { recordView } from "@/lib/posts/views";

const postIdSchema = z.uuid();
const NOT_FOUND: SaveResult = { ok: false, errors: { form: "Only your own open posts can be edited." } };

// Inputs are typed as unknown: they come from the browser and are validated
// by parseNewPost / parsePostEdit before anything is written.

export async function createPostAction(input: unknown): Promise<SaveResult> {
  const me = await requireActiveStudent();
  const result = await createPost({ ownerId: me.id, input });
  if (result.ok) refresh();
  return result;
}

export async function updatePostAction(postId: unknown, input: unknown): Promise<SaveResult> {
  const me = await requireActiveStudent();
  const id = postIdSchema.safeParse(postId);
  if (!id.success) return NOT_FOUND;
  const result = await updatePost({ ownerId: me.id, postId: id.data, input, store: getObjectStore() });
  if (result.ok) refresh();
  return result;
}

export async function withdrawPostAction(postId: unknown): Promise<{ ok: boolean; error?: string }> {
  const me = await requireActiveStudent();
  const id = postIdSchema.safeParse(postId);
  if (!id.success) return { ok: false };
  const result = await withdrawPost(me.id, id.data);
  if (result === "ok") refresh();
  return {
    ok: result === "ok",
    error: result === "has_reservations" ? "Cancel the reservations first. Open them in your messages." : undefined,
  };
}

/** Saves an expired post's details and lists it again for 30 days. */
export async function relistPostAction(postId: unknown, input: unknown): Promise<SaveResult> {
  const me = await requireActiveStudent();
  const id = postIdSchema.safeParse(postId);
  if (!id.success) return { ok: false, errors: { form: "Only your own expired posts can be relisted." } };
  const result = await updatePost({ ownerId: me.id, postId: id.data, input, store: getObjectStore(), relist: true });
  if (result.ok) refresh();
  return result;
}

/** Counts one view for the signed-in student. Called from the post page after it is shown. */
export async function recordViewAction(postId: unknown): Promise<void> {
  const me = await requireActiveStudent();
  const id = postIdSchema.safeParse(postId);
  if (id.success) await recordView(me.id, id.data);
}
