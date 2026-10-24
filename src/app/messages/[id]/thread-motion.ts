"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * The keys that appeared after the thread was first shown, for the conversation `scope`. What is there when the
 * conversation opens is not new, and a key stays "arrived" afterwards, so an element eases in once and keeps its class.
 */
export function useArrivals(scope: string, keys: string[]): ReadonlySet<string> {
  const [seen, setSeen] = useState(() => ({ scope, known: new Set(keys), arrived: new Set<string>() }));
  if (seen.scope !== scope) {
    setSeen({ scope, known: new Set(keys), arrived: new Set() });
  } else if (keys.some((key) => !seen.known.has(key))) {
    setSeen({
      scope,
      known: new Set([...seen.known, ...keys]),
      arrived: new Set([...seen.arrived, ...keys.filter((key) => !seen.known.has(key))]),
    });
  }
  return seen.arrived;
}

/** The message at the top of the screen, where it is on the screen, and how far the page was scrolled. */
type Place = { id: string; top: number; scrollY: number };

function placeOnScreen(): Place | null {
  for (const el of document.querySelectorAll<HTMLElement>("[data-place]")) {
    const { top, bottom } = el.getBoundingClientRect();
    if (bottom > 0) return { id: el.dataset.place ?? "", top, scrollY: window.scrollY };
  }
  return null;
}

/**
 * Keeps what the reader is looking at where it is. Safari does not hold the place when something above the screen
 * changes height (a card that moves down the thread, a message that arrives above), so after every update the page is
 * scrolled by however far the message at the top of the screen moved. Not while following the newest message: the
 * page is kept at the bottom then. Messages need `data-place="<id>"`.
 */
export function useKeepPlace(following: RefObject<boolean>) {
  const place = useRef<Place | null>(null);

  useLayoutEffect(() => {
    const was = place.current;
    if (was && !following.current) {
      const el = document.querySelector<HTMLElement>(`[data-place="${was.id}"]`);
      if (el) {
        // Where it would be had only the reader scrolled, against where it is: the difference is the page shifting.
        const shift = el.getBoundingClientRect().top - (was.top - (window.scrollY - was.scrollY));
        if (Math.abs(shift) >= 1) window.scrollBy(0, shift);
      }
    }
    place.current = following.current ? null : placeOnScreen();
  });

  useEffect(() => {
    let frame = 0;
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        place.current = following.current ? null : placeOnScreen();
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [following]);
}
