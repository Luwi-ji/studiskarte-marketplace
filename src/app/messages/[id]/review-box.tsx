"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { submitReviewAction } from "@/app/deals/actions";
import { StarRow } from "@/components/stars";
import type { DealCardData } from "./handover-panel";
import { NO_ANSWER, ReloadButton } from "./reload-hint";

const primary = "h-11 rounded-lg bg-brand font-medium text-white disabled:opacity-60";
const REVIEW_MAX = 500;

/** One side's review: their stars and what they wrote. */
function Said({ who, review }: { who: string; review: { rating: number; text: string | null } }) {
  return (
    <div className="text-sm">
      <p>
        <span className="font-medium">{who}</span> <StarRow rating={review.rating} />
      </p>
      {review.text ? <p className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">{review.text}</p> : null}
    </div>
  );
}

/**
 * Rating the other person once a handover is complete: one to five stars and
 * an optional note. A review cannot be changed afterwards, so once sent it is
 * only shown, next to what they said about you.
 */
export function ReviewBox({ deal, otherName }: { deal: DealCardData; otherName: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!deal.review) return null;
  const { mine, theirs } = deal.review;

  async function send(text: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await submitReviewAction(deal.id, { rating, text });
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError(NO_ANSWER);
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      {mine ? (
        <Said who={`You rated ${otherName}`} review={mine} />
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send(String(new FormData(event.currentTarget).get("text") ?? ""));
          }}
        >
          <p className="text-sm font-medium">How did it go with {otherName}?</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={n === 1 ? "1 star" : `${n} stars`}
                aria-pressed={rating === n}
                className={`h-11 w-11 rounded-lg border text-2xl leading-none ${rating >= n ? "border-amber-500 text-amber-500" : "border-zinc-300 text-zinc-400 dark:border-zinc-700"}`}
                disabled={busy}
                onClick={() => setRating(n)}
              >
                {rating >= n ? "★" : "☆"}
              </button>
            ))}
          </div>
          <textarea
            name="text"
            rows={3}
            maxLength={REVIEW_MAX}
            placeholder="Say how it went (optional)"
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
          {error === NO_ANSWER ? <ReloadButton /> : null}
          <button type="submit" className={primary} disabled={busy || rating === 0}>
            {busy ? "Sending…" : "Send review"}
          </button>
        </form>
      )}
      {theirs ? <Said who={`${otherName} rated you`} review={theirs} /> : null}
    </div>
  );
}
