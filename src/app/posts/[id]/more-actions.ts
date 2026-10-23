"use server";

import { requireActiveStudent } from "@/lib/access";
import { toCards, type PostCardData } from "@/lib/discovery/cards";
import { listMoreLikeThis, moreContext, type MoreGroup } from "@/lib/posts/more";

export type MoreEntry = { card: PostCardData; group: MoreGroup };

/** The next listings under a post after `cursor`. A post the student cannot see, or a bad cursor, gives the first page or nothing. */
export async function loadMoreLikeThisAction(postId: unknown, cursor: unknown): Promise<{ entries: MoreEntry[]; nextCursor: string | null }> {
  const me = await requireActiveStudent();
  const context = typeof postId === "string" ? await moreContext(me.id, postId) : null;
  if (!context) return { entries: [], nextCursor: null };
  const page = await listMoreLikeThis(me.id, context, { cursor: typeof cursor === "string" ? cursor : null });
  const cards = await toCards(page.items);
  return { entries: cards.map((card, i) => ({ card, group: page.items[i].group })), nextCursor: page.nextCursor };
}
