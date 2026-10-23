"use client";

import { useState } from "react";
import { Card } from "@/components/post-card";
import type { PostCardData } from "@/lib/discovery/cards";
import { loadMoreLikeThisAction, type MoreEntry } from "./more-actions";

/** Cards side by side that swipe left and right, each snapping into place; the next card peeks in at the edge. */
function SwipeRow({ cards, label }: { cards: PostCardData[]; label: string }) {
  return (
    <ul
      aria-label={label}
      className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {cards.map((card) => (
        <li key={card.id} className="flex w-[8.5rem] shrink-0 snap-start">
          <div className="flex w-full [&>*]:w-full">
            <Card card={card} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * The listings under a post, grouped under a plain heading each, with a
 * "Show more" button until they run out and then a way back up to the post.
 */
export function MoreList({
  postId,
  sellerHandle,
  categoryName,
  initialEntries,
  nextCursor,
}: {
  postId: string;
  sellerHandle: string | null;
  categoryName: string;
  initialEntries: MoreEntry[];
  nextCursor: string | null;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [cursor, setCursor] = useState(nextCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const page = await loadMoreLikeThisAction(postId, cursor);
      // A post can only appear once, even if the student taps twice.
      setEntries((current) => [...current, ...page.entries.filter((entry) => !current.some((e) => e.card.id === entry.card.id))]);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  function backToPost() {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: calm ? "instant" : "smooth" });
  }

  const seller = entries.filter((e) => e.group === 0).map((e) => e.card);
  const category = entries.filter((e) => e.group === 1).map((e) => e.card);

  return (
    <section aria-label="More listings" className="flex flex-col gap-6 border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
      {seller.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">{sellerHandle ? `More from @${sellerHandle}` : "More from this seller"}</h2>
          <SwipeRow cards={seller} label="Swipe to see more listings from this seller" />
        </div>
      ) : null}
      {category.length > 0 ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">More in {categoryName}</h2>
          <SwipeRow cards={category} label={`Swipe to see more listings in ${categoryName}`} />
        </div>
      ) : null}
      {failed ? (
        <p role="alert" className="text-center text-sm text-red-600">
          Could not load more. Check your connection and try again.
        </p>
      ) : null}
      {cursor ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mx-auto flex h-11 w-full max-w-xs items-center justify-center rounded-lg border border-zinc-300 font-medium dark:border-zinc-700"
        >
          {loading ? "Loading…" : "Show more"}
        </button>
      ) : (
        <div className="flex flex-col items-center gap-1 text-zinc-500">
          <p className="text-sm">You&apos;ve seen everything</p>
          <button
            type="button"
            onClick={backToPost}
            aria-label="Back to the listing"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-300 transition-colors duration-200 ease-out active:bg-zinc-100 motion-reduce:transition-none dark:border-zinc-700 dark:active:bg-zinc-800"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19V5" />
              <path d="M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}
