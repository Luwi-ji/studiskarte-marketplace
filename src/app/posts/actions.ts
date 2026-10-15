"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireActiveStudent } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { createPost, type SaveResult } from "@/lib/posts/create";
import { withdrawPost } from "@/lib/posts/transitions";
import { updatePost } from "@/lib/posts/update";

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

export async function withdrawPostAction(postId: unknown): Promise<{ ok: boolean }> {
  const me = await requireActiveStudent();
  const id = postIdSchema.safeParse(postId);
  if (!id.success) return { ok: false };
  const ok = await withdrawPost(me.id, id.data);
  if (ok) refresh();
  return { ok };
}
