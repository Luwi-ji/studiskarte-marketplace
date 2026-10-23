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

/** A school as a card names it. An admin's abbreviation wins; else "Technological University of the Philippines" becomes "TUP". */
export function shortSchool(name: string, short: string | null): string {
  if (short?.trim()) return short.trim();
  const words = name.split(/[\s-]+/).filter((w) => /^[A-Z]/.test(w));
  return words.length >= 2 && words.length <= 6 ? words.map((w) => w[0]).join("") : name;
}

/** What a card shows, with its photo already linked. Plain data, so it can cross to the browser. */
export type PostCardData = Pick<FeedItem, "id" | "kind" | "status" | "title" | "priceKind" | "priceAmount" | "ownerHandle" | "meetupLocation" | "hearted"> & {
  /** "TUP-M": the abbreviation an admin set, else the capital letters of the name, else the name itself. */
  schoolShort: string;
  /** The whole name, for screen readers and tooltips. */
  school: string;
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
      schoolShort: shortSchool(item.school, item.schoolShort),
      meetupLocation: item.meetupLocation,
      hearted: item.hearted,
      photoUrl: await store.signedUrl(item.thumbKey, PHOTO_LINK_SECONDS),
    })),
  );
}
