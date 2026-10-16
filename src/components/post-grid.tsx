import { CardGrid } from "@/components/post-card";
import { toCards } from "@/lib/discovery/cards";
import type { FeedItem } from "@/lib/discovery/feed";

/** Cards for a list of posts: a profile, the hearted list. */
export async function PostGrid({ items }: { items: FeedItem[] }) {
  return <CardGrid cards={await toCards(items)} />;
}
