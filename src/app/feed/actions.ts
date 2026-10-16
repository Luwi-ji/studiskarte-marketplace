"use server";

import { requireActiveStudent } from "@/lib/access";
import { toCards, type PostCardData } from "@/lib/discovery/cards";
import { listFeed } from "@/lib/discovery/feed";

/** The next page of the feed after `cursor`. A bad cursor gives the first page. */
export async function loadMoreFeedAction(cursor: unknown): Promise<{ cards: PostCardData[]; nextCursor: string | null }> {
  const me = await requireActiveStudent();
  const page = await listFeed(me.id, { cursor: typeof cursor === "string" ? cursor : null });
  return { cards: await toCards(page.items), nextCursor: page.nextCursor };
}
