"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { FACEBOOK_REVIEWS_URL } from "@/lib/support/config";
import { afterNever, afterReviewOpened, afterShown, parseReviewState, REVIEW_PROMPT_KEY, shouldPrompt, type ReviewPromptState } from "@/lib/support/review-prompt";

const COPY = {
  posted: { title: "Your post is live", body: "Enjoying Studiskarte so far? A quick review on our Facebook page helps other students find it." },
  completed: { title: "That handover is done", body: "Glad it worked out. A quick review on our Facebook page helps other students find Studiskarte." },
} as const;

// Storage can be missing, full or blocked (a private tab): then the prompt simply does not appear.
function readState(): ReviewPromptState | null {
  try {
    return parseReviewState(window.localStorage.getItem(REVIEW_PROMPT_KEY));
  } catch {
    return null;
  }
}

function writeState(state: ReviewPromptState) {
  try {
    window.localStorage.setItem(REVIEW_PROMPT_KEY, JSON.stringify(state));
  } catch {
    // Nothing to do.
  }
}

const BUTTON = "press flex h-12 w-full items-center justify-center rounded-lg font-medium";

/**
 * Asks, now and then, for a review on the Facebook page, after a good moment: a post that went live or a completed
 * handover. Shown at most once per 14 days per device, never twice for the same moment, never after "Don't ask again",
 * and not for 90 days after the review page was opened. `momentKey` names the moment; `happenedAt` (an ISO time) lets a
 * completed deal that is more than 48 hours old pass quietly. Renders nothing until it opens.
 */
export function ReviewPrompt({ momentKey, context, happenedAt }: { momentKey: string; context: keyof typeof COPY; happenedAt?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const state = readState();
      if (!state) return;
      const when = happenedAt === undefined ? undefined : Date.parse(happenedAt);
      const now = Date.now();
      if (!shouldPrompt(state, momentKey, now, when)) return;
      writeState(afterShown(state, momentKey, now));
      setOpen(true);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [momentKey, happenedAt]);

  function remember(next: (state: ReviewPromptState) => ReviewPromptState) {
    writeState(next(readState() ?? {}));
    setOpen(false);
  }

  const copy = COPY[context];
  return (
    <BottomSheet open={open} onOpenChange={setOpen} label="Leave a review" portal>
      <div className="flex flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
        <h2 className="text-lg font-semibold">{copy.title}</h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{copy.body}</p>
        <a
          href={FACEBOOK_REVIEWS_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => remember((state) => afterReviewOpened(state, Date.now()))}
          className={`${BUTTON} bg-brand text-white`}
        >
          Leave a review on Facebook
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
        <button type="button" onClick={() => setOpen(false)} className={`${BUTTON} border border-zinc-300 dark:border-zinc-700`}>
          Maybe later
        </button>
        <button type="button" onClick={() => remember(afterNever)} className="press flex h-11 w-full items-center justify-center text-sm font-medium text-zinc-600 underline dark:text-zinc-400">
          Don&apos;t ask again
        </button>
      </div>
    </BottomSheet>
  );
}
