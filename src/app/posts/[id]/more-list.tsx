"use client";

import { Card } from "@/components/post-card";
import type { PostCardData } from "@/lib/discovery/cards";
import type { MoreGroup } from "@/lib/posts/more";

/** Cards side by side that swipe left and right, each snapping into place; the next card peeks in at the edge. */
function SwipeRow({ cards, label }: { cards: PostCardData[]; label: string }) {
  return (
    <ul
      aria-label={label}
      data-haptic-scroll
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

export type MoreEntry = { card: PostCardData; group: MoreGroup };

/** The listings under a post: a fixed batch, grouped under a plain heading each, then a way back up to the post. */
export function MoreList({
  sellerHandle,
  categoryName,
  entries,
}: {
  sellerHandle: string | null;
  categoryName: string;
  entries: MoreEntry[];
}) {
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
      <div className="flex justify-center">
        <button
          type="button"
          onClick={backToPost}
          aria-label="Back to the listing"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-300 text-zinc-500 transition-colors duration-200 ease-out active:bg-zinc-100 motion-reduce:transition-none dark:border-zinc-700 dark:active:bg-zinc-800"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 19V5" />
            <path d="M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </section>
  );
}
