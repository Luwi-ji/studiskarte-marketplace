"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireActiveStudent } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { BULK_MAX, changePosts, type BulkResult } from "@/lib/posts/bulk";
import { BULK_ACTIONS } from "@/lib/posts/own-view";

const requestSchema = z.object({
  action: z.enum(BULK_ACTIONS),
  ids: z.array(z.uuid()).min(1).max(BULK_MAX),
});

export type BulkResponse = { ok: true; results: BulkResult[] } | { ok: false; error: string };

/**
 * Relists, withdraws or deletes several of the signed-in student's posts at once (My posts, select mode). Each post
 * goes through the same rules as the single-post actions and gets its own result, so the page can say which ones
 * changed and why the others did not.
 */
export async function bulkPostsAction(input: unknown): Promise<BulkResponse> {
  const me = await requireActiveStudent();
  const request = requestSchema.safeParse(input);
  if (!request.success) return { ok: false, error: `Choose between 1 and ${BULK_MAX} posts.` };
  const results = await changePosts({ ownerId: me.id, action: request.data.action, ids: request.data.ids, store: getObjectStore() });
  if (results.some((r) => r.ok)) refresh();
  return { ok: true, results };
}
