"use client";

import { useRef, useState } from "react";

/**
 * Swipe sideways through a post's photos (native scroll-snap, no library).
 * The counter follows the photo in view. The full-screen viewer is Phase 6.
 */
export function PhotoCarousel({ urls, title }: { urls: string[]; title: string }) {
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);

  function onScroll() {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div className="relative bg-zinc-100 dark:bg-zinc-900">
      <ul
        ref={track}
        onScroll={onScroll}
        className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Photos"
      >
        {urls.map((url, i) => (
          <li key={url} className="h-full w-full shrink-0 snap-center">
            {/* Signed, short-lived link; next/image would route private photos through the optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`${title}, photo ${i + 1} of ${urls.length}`} className="h-full w-full object-contain" loading={i === 0 ? "eager" : "lazy"} />
          </li>
        ))}
      </ul>
      {urls.length > 1 ? (
        <>
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white" aria-live="polite">
            {index + 1}/{urls.length}
          </span>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden>
            {urls.map((url, i) => (
              <span key={url} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
