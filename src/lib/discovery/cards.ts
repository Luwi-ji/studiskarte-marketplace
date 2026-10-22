import type { FeedItem } from "@/lib/discovery/feed";
import { getObjectStore } from "@/lib/images/store";

const PHOTO_LINK_SECONDS = 5 * 60;

/** How long ago a post was listed, as a card shows it: "Just now", "5h ago", "2d ago". */
export function listedAgo(listedAt: Date, now = new Date()): string {
  const hours = Math.floor((now.getTime() - listedAt.getTime()) / (60 * 60 * 1000));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** What a card shows, with its photo already linked. Plain data, so it can cross to the browser. */
export type PostCardData = Pick<FeedItem, "id" | "kind" | "status" | "title" | "priceKind" | "priceAmount" | "ownerHandle" | "school"> & {
  photoUrl: string;
  /** "2d ago", worked out when the page was built. */
  listedAgo: string;
};

/** Cards for a list of posts, each with a short-lived link to its thumbnail. */
export async function toCards(items: FeedItem[]): Promise<PostCardData[]> {
  if (items.length === 0) return [];
  const store = getObjectStore();
  return Promise.all(
    items.map(async (item) => ({
      id: item.id,
      kind: item.kind,
      status: item.status,
      title: item.title,
      listedAgo: listedAgo(item.listedAt),
      priceKind: item.priceKind,
      priceAmount: item.priceAmount,
      ownerHandle: item.ownerHandle,
      school: item.school,
      photoUrl: await store.signedUrl(item.thumbKey, PHOTO_LINK_SECONDS),
    })),
  );
}
