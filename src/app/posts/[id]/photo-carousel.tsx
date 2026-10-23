"use client";

import { useRef, useState, type ReactNode } from "react";

type Photo = { url: string; caption: string | null };

/** Index of the photo in view in a horizontal scroll-snap list. */
function indexIn(list: HTMLElement): number {
  return Math.round(list.scrollLeft / list.clientWidth);
}

/**
 * Swipe sideways through a post's photos (native scroll-snap, no library).
 * Tapping a photo opens it full screen in a native <dialog>, where the swipe
 * continues on a black background. The counter and the caption follow the
 * photo in view, in both.
 */
export function PhotoCarousel({ photos, title, left, right }: { photos: Photo[]; title: string; left?: ReactNode; right?: ReactNode }) {
  const track = useRef<HTMLUListElement>(null);
  const fullTrack = useRef<HTMLUListElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [fullIndex, setFullIndex] = useState(0);
  const hasCaptions = photos.some((p) => p.caption);

  function openFull() {
    setFullIndex(index);
    dialog.current?.showModal();
    // The list is only measurable once the dialog is open.
    const list = fullTrack.current;
    if (list) list.scrollTo({ left: index * list.clientWidth, behavior: "instant" });
  }

  function onClose() {
    // Leave the page on the photo the student ended on.
    const list = track.current;
    if (list) list.scrollTo({ left: fullIndex * list.clientWidth, behavior: "instant" });
    setIndex(fullIndex);
  }

  return (
    <div>
      <div className="relative bg-zinc-100 dark:bg-zinc-900">
        <ul
          ref={track}
          onScroll={(e) => setIndex(indexIn(e.currentTarget))}
          className="flex aspect-square w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Photos"
        >
          {photos.map((photo, i) => (
            <li key={photo.url} className="h-full w-full shrink-0 snap-center">
              <button type="button" onClick={openFull} aria-label="View photo full screen" className="block h-full w-full">
                {/* Signed, short-lived link; next/image would route private photos through the optimizer. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption ?? `${title}, photo ${i + 1} of ${photos.length}`}
                  className="h-full w-full object-contain"
                  loading={i === 0 ? "eager" : "lazy"}
                />
              </button>
            </li>
          ))}
        </ul>
        {photos.length > 1 ? (
          <>
            <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
              {index + 1}/{photos.length}
            </span>
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5" aria-hidden>
              {photos.map((photo, i) => (
                <span key={photo.url} className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-white" : "bg-white/50"}`} />
              ))}
            </div>
          </>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] [&>*]:pointer-events-auto">
          <div className="flex gap-2">{left}</div>
          <div className="flex gap-2">{right}</div>
        </div>
      </div>
      {hasCaptions ? (
        <p className="min-h-11 whitespace-pre-line border-b border-zinc-200 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300" aria-live="polite">
          {photos[index]?.caption ?? ""}
        </p>
      ) : null}

      <dialog
        ref={dialog}
        onClose={onClose}
        aria-label={`${title}, photos`}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
      >
        <div className="relative flex h-full w-full flex-col">
          <ul
            ref={fullTrack}
            onScroll={(e) => setFullIndex(indexIn(e.currentTarget))}
            className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Photos, full screen"
          >
            {photos.map((photo, i) => (
              <li key={photo.url} className="flex h-full w-full shrink-0 snap-center items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption ?? `${title}, photo ${i + 1} of ${photos.length}`}
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                />
              </li>
            ))}
          </ul>
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-2 pt-[env(safe-area-inset-top)]">
            <span className="ml-2 rounded-full bg-black/60 px-2.5 py-1 text-sm">
              {fullIndex + 1}/{photos.length}
            </span>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Close"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-2xl"
            >
              ×
            </button>
          </div>
          {photos[fullIndex]?.caption ? (
            <p className="whitespace-pre-line bg-black/80 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 text-sm">{photos[fullIndex].caption}</p>
          ) : (
            <div className="h-[env(safe-area-inset-bottom)]" />
          )}
        </div>
      </dialog>
    </div>
  );
}
