"use client";

import { useEffect, useRef, useState } from "react";
import { BackToTop } from "@/components/back-to-top";
import { CardGrid } from "@/components/post-card";
import { PAGE_REFRESHED_EVENT } from "@/components/pull-to-refresh";
import type { PostCardData } from "@/lib/discovery/cards";
import { loadMoreFeedAction } from "./actions";

/**
 * The pages after the first, added below it as the student asks for them.
 * `params` are the page's filters, sort and search, so the next pages match.
 */
export function MoreCards({ params, nextCursor }: { params: Record<string, string>; nextCursor: string | null }) {
  const [cards, setCards] = useState<PostCardData[]>([]);
  const [cursor, setCursor] = useState<string | null>(nextCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const firstCursor = useRef(nextCursor);

  // A pull-to-refresh brings a new first page: drop the pages loaded after the old one and continue from the new one.
  useEffect(() => {
    firstCursor.current = nextCursor;
  }, [nextCursor]);
  useEffect(() => {
    function reset() {
      setCards([]);
      setCursor(firstCursor.current);
      setFailed(false);
    }
    window.addEventListener(PAGE_REFRESHED_EVENT, reset);
    return () => window.removeEventListener(PAGE_REFRESHED_EVENT, reset);
  }, []);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const page = await loadMoreFeedAction(params, cursor);
      // A post can only appear once, even if the student taps twice.
      setCards((current) => [...current, ...page.cards.filter((card) => !current.some((c) => c.id === card.id))]);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {cards.length > 0 ? <CardGrid cards={cards} /> : null}
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
          <BackToTop />
        </div>
      )}
    </>
  );
}
