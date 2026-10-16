"use client";

import { useRef, useState } from "react";

type Photo = { url: string; caption: string | null };

/**
 * Swipe sideways through a post's photos (native scroll-snap, no library).
 * The counter and the caption follow the photo in view. The full-screen
 * viewer is Phase 6.
 */
export function PhotoCarousel({ photos, title }: { photos: Photo[]; title: string }) {
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const hasCaptions = photos.some((p) => p.caption);

  function onScroll() {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }

  return (
    <div>
      <div className="relative bg-zinc-100 dark:bg-zinc-900">
        <ul
          ref={track}
          onScroll={onScroll}
          className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Photos"
        >
          {photos.map((photo, i) => (
            <li key={photo.url} className="h-full w-full shrink-0 snap-center">
              {/* Signed, short-lived link; next/image would route private photos through the optimizer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.caption ?? `${title}, photo ${i + 1} of ${photos.length}`}
                className="h-full w-full object-contain"
                loading={i === 0 ? "eager" : "lazy"}
              />
            </li>
          ))}
        </ul>
        {photos.length > 1 ? (
          <>
            <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
              {index + 1}/{photos.length}
            </span>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden>
              {photos.map((photo, i) => (
                <span key={photo.url} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`} />
              ))}
            </div>
          </>
        ) : null}
      </div>
      {hasCaptions ? (
        <p className="min-h-11 whitespace-pre-line border-b border-zinc-200 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300" aria-live="polite">
          {photos[index]?.caption ?? ""}
        </p>
      ) : null}
    </div>
  );
}
