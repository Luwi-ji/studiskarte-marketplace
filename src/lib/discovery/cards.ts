import type { FeedItem } from "@/lib/discovery/feed";
import { getObjectStore } from "@/lib/images/store";

const PHOTO_LINK_SECONDS = 5 * 60;

/** What a card shows, with its photo already linked. Plain data, so it can cross to the browser. */
export type PostCardData = Pick<FeedItem, "id" | "kind" | "title" | "priceKind" | "priceAmount" | "ownerHandle" | "school"> & {
  photoUrl: string;
};

/** Cards for a list of posts, each with a short-lived link to its thumbnail. */
export async function toCards(items: FeedItem[]): Promise<PostCardData[]> {
  if (items.length === 0) return [];
  const store = getObjectStore();
  return Promise.all(
    items.map(async (item) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      priceKind: item.priceKind,
      priceAmount: item.priceAmount,
      ownerHandle: item.ownerHandle,
      school: item.school,
      photoUrl: await store.signedUrl(item.thumbKey, PHOTO_LINK_SECONDS),
    })),
  );
}
