import { toCards } from "@/lib/discovery/cards";
import { listMoreLikeThis, moreContext, MORE_FIRST_BATCH } from "@/lib/posts/more";
import type { MoreEntry } from "./more-actions";
import { MoreList } from "./more-list";

/**
 * What to keep reading under a post: the same seller's other listings first,
 * then listings in the same category. Renders nothing when there are none.
 */
export async function MorePosts({ viewerId, postId, ownerId, categoryId }: { viewerId: string; postId: string; ownerId: string; categoryId: string }) {
  const context = await moreContext(viewerId, postId);
  // The seller and category come from the page's own post; the lookup also gives the names the headings show.
  if (!context || context.ownerId !== ownerId || context.categoryId !== categoryId) return null;
  const page = await listMoreLikeThis(viewerId, context, { limit: MORE_FIRST_BATCH });
  if (page.items.length === 0) return null;
  const cards = await toCards(page.items);
  const entries: MoreEntry[] = cards.map((card, i) => ({ card, group: page.items[i].group }));
  return (
    <MoreList
      postId={postId}
      sellerHandle={context.ownerHandle}
      categoryName={context.categoryName}
      initialEntries={entries}
      nextCursor={page.nextCursor}
    />
  );
}
