"use client";

import { useState } from "react";
import { CardGrid } from "@/components/post-card";
import type { PostCardData } from "@/lib/discovery/cards";
import { loadMoreFeedAction } from "./actions";

/** The pages after the first, added below it as the student asks for them. */
export function MoreCards({ nextCursor }: { nextCursor: string | null }) {
  const [cards, setCards] = useState<PostCardData[]>([]);
  const [cursor, setCursor] = useState<string | null>(nextCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const page = await loadMoreFeedAction(cursor);
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
        <p className="py-2 text-center text-sm text-zinc-500">You have seen everything.</p>
      )}
    </>
  );
}
