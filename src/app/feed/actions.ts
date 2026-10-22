"use server";

import { z } from "zod";
import { requireActiveStudent } from "@/lib/access";
import { toCards, type PostCardData } from "@/lib/discovery/cards";
import { listFeed } from "@/lib/discovery/feed";
import { parseFilters } from "@/lib/discovery/filters";
import { filterOptions } from "@/lib/discovery/page-data";

// The filters come back from the browser as the page's query-string values.
const paramsSchema = z.record(z.string().max(40), z.string().max(200)).refine((p) => Object.keys(p).length <= 12);

/** The next page after `cursor` for the same filters, sort and search. A bad cursor gives the first page. */
export async function loadMoreFeedAction(params: unknown, cursor: unknown): Promise<{ cards: PostCardData[]; nextCursor: string | null }> {
  const me = await requireActiveStudent();
  const parsed = paramsSchema.safeParse(params);
  const page = await listFeed(me.id, {
    filters: parseFilters(parsed.success ? parsed.data : {}),
    cursor: typeof cursor === "string" ? cursor : null,
  });
  return { cards: await toCards(page.items), nextCursor: page.nextCursor };
}

/** The categories and schools the Filters sheet and the category drawer list, for a tap that comes before the page has brought them. */
export async function loadFilterOptionsAction() {
  const me = await requireActiveStudent();
  return filterOptions(me.id);
}
