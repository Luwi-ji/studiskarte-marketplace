"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore, type FocusEvent } from "react";

// Within this far of the top the chrome is always shown; hiding needs a clear downward move, showing a clear upward one.
const TOP_PX = 24;
const MOVE_PX = 8;

// One scroll listener for every subscriber (the page header and the tab bar), so they hide and show in the same frame.
const listeners = new Set<() => void>();
let hidden = false;
let last = 0;
let travel = 0;
let frame = 0;
let observer: ResizeObserver | null = null;

function setHidden(next: boolean) {
  if (next === hidden) return;
  hidden = next;
  listeners.forEach((listener) => listener());
}

function update() {
  frame = 0;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const y = Math.min(Math.max(window.scrollY, 0), Math.max(max, 0));
  const dy = y - last;
  last = y;
  if (max <= 0 || y <= TOP_PX || document.querySelector("dialog[open]")) {
    travel = 0;
    setHidden(false);
    return;
  }
  if (dy === 0) return;
  // Moves in one direction add up, so a slow scroll still passes the dead zone; a turn starts the count over.
  travel = Math.sign(dy) === Math.sign(travel) ? travel + dy : dy;
  if (travel >= MOVE_PX) setHidden(true);
  else if (travel <= -MOVE_PX) setHidden(false);
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(update);
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    last = window.scrollY;
    travel = 0;
    window.addEventListener("scroll", schedule, { passive: true });
    // The page can shrink until it no longer scrolls (a filter with few results): then there is nothing to hide for.
    observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    window.removeEventListener("scroll", schedule);
    observer?.disconnect();
    observer = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    hidden = false;
  };
}

function reveal() {
  last = window.scrollY;
  travel = 0;
  setHidden(false);
}

/**
 * Whether the pinned chrome (page header row, tab bar) should be out of view: true after scrolling down, false again on
 * any upward move, near the top, when the page cannot scroll, while a sheet is open, after a navigation (a new path or
 * a different `resetKey`) and while focus is inside the element that gets `focusProps` (a keyboard user never loses it).
 */
export function useScrollDirection(resetKey = "") {
  const pathname = usePathname();
  const scrolledAway = useSyncExternalStore(subscribe, () => hidden, () => false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    reveal();
  }, [pathname, resetKey]);

  const onFocus = useCallback((event: FocusEvent) => {
    // A tap on a button focuses it without a ring; only a field or a keyboard focus pins the chrome.
    if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) setFocused(true);
  }, []);
  const onBlur = useCallback((event: FocusEvent) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  }, []);

  return { hidden: scrolledAway && !focused, focusProps: { onFocus, onBlur } };
}
