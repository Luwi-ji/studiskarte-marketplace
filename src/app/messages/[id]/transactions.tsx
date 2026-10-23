import { ProductCard } from "@/components/product-card";
import type { PostCard } from "@/lib/messaging/read";

/** A listing with its picture link, ready to show. */
export type PostCardData = { post: PostCard; thumbUrl: string };

/** A listing in this thread: from the viewer's side, with where its transaction stands. */
export type ListingCardData = PostCardData & { viewerIsOwner: boolean; state: string | null };

/**
 * The states (from `transactionLabel`) of a transaction that is over: finished, cancelled, reported, or an offer
 * that was declined, withdrawn or ran out. Anything else is still going on, and so is a listing with no offer yet.
 */
const PAST_STATES: Record<string, true> = {
  Completed: true,
  "Reservation cancelled": true,
  Reported: true,
  "Offer declined": true,
  "Offer withdrawn": true,
  "Offer expired": true,
};

/**
 * Every listing the two have dealt about, ongoing first and then past, each with its state (an offer waiting,
 * reserved, completed…). Each one opens the listing. Shown as a step of the thread's three-dot menu.
 */
export function TransactionList({ listings }: { listings: ListingCardData[] }) {
  const isPast = (l: ListingCardData) => l.state !== null && PAST_STATES[l.state] === true;
  const groups = [
    { title: "Ongoing", items: listings.filter((l) => !isPast(l)) },
    { title: "Past", items: listings.filter(isPast) },
  ].filter((g) => g.items.length > 0);
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <section key={g.title} aria-label={g.title} className="flex flex-col gap-2">
          <h3 className="px-1 text-sm font-semibold text-zinc-600 dark:text-zinc-400">{g.title}</h3>
          <ul className="flex flex-col gap-2">
            {g.items.map((l) => (
              <li key={l.post.id}>
                <p className="px-1 pb-1 text-xs text-zinc-500">{l.viewerIsOwner ? "Your post" : "Their post"}</p>
                <ProductCard post={l.post} thumbUrl={l.thumbUrl} state={l.state} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
