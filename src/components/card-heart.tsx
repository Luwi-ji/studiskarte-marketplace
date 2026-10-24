"use client";

import { useOptimistic, useTransition } from "react";
import { setHeartAction } from "@/app/social/actions";

/**
 * The heart on a listing card. A small glyph in a 44 px tap area; it sits beside the card's link, never inside it,
 * so a tap hearts the post and does not open it. Shows the change at once and puts it back if the server refuses
 * (as it does for your own post).
 */
export function CardHeart({ postId, initial }: { postId: string; initial: boolean }) {
  const [hearted, setHearted] = useOptimistic(initial);
  const [busy, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      setHearted(!hearted);
      try {
        await setHeartAction(postId, !hearted);
      } catch {
        // The optimistic state rolls back when the transition finishes.
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={hearted}
      aria-label={hearted ? "Remove heart" : "Heart this post"}
      className="press relative z-10 -my-2 -mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
    >
      <svg viewBox="0 0 24 24" className={`h-5 w-5 ${hearted ? "fill-red-500 stroke-red-500" : "fill-none stroke-zinc-500 dark:stroke-zinc-400"}`} strokeWidth="2" aria-hidden>
        <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3 5 6.5 5c2 0 3.5 1.1 5.5 3.2C14 6.1 15.5 5 17.5 5 21 5 22.8 8.6 21.5 11.8 19.5 16.4 12 21 12 21z" />
      </svg>
    </button>
  );
}
