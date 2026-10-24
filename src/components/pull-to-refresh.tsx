"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { haptic } from "@/lib/haptics";

/** Sent on `window` once a pull-to-refresh has brought in fresh data, so a list that keeps pages of its own can start over. */
export const PAGE_REFRESHED_EVENT = "studiskarte:refreshed";

/** The page never follows the finger further than this (px). */
const MAX_PULL = 72;
/** Letting go from this far (px) refreshes. */
const THRESHOLD = 56;
/** The finger must move this far (px) down, more down than sideways, before it counts as a pull. */
const SLOP = 6;
/** The spinner stays at least this long (ms), so a quick refresh is still seen. */
const MIN_SPIN_MS = 600;
const FADE_MS = 200;
/** The check stays this long (ms) before the indicator fades out. */
const DONE_MS = 450;
/** The progress ring's arc (of 100): empty, and the short arc that turns while refreshing. */
const ARC_EMPTY = "0 100";
const ARC_REFRESHING = "28 72";
/** How far the page stays open while it refreshes (px). */
const REST_Y = 48;

/** Where a pull must not start: text fields, a text selection being dragged, and anything that opts out with `data-no-pull`. */
const BLOCKED = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-no-pull]';
const SCROLLS = /auto|scroll/;

/** How far the indicator moves for a finger that moved `d`: close to the finger at first, then harder and harder, never past MAX_PULL. */
function resist(d: number): number {
  return MAX_PULL * (1 - Math.exp(-d / 60));
}

/** Can a pull start from here? Not inside a text field, an open sheet or dialog, a text selection, a row that scrolls sideways or a panel that is scrolled down. */
function canPullFrom(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || window.scrollY > 0) return false;
  if (target.closest(BLOCKED) || document.querySelector("dialog[open], [aria-modal='true']")) return false;
  if (window.getSelection()?.type === "Range") return false;
  for (let el: Element | null = target; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (SCROLLS.test(style.overflowX) && el.scrollWidth > el.clientWidth) return false;
    if (SCROLLS.test(style.overflowY) && el.scrollHeight > el.clientHeight && el.scrollTop > 0) return false;
  }
  return true;
}

/** Opens a gap of `y` px at the top of the page (`--ptr`, read by `body` in globals.css); the spinner sits centred in it. */
function place(disc: HTMLElement, y: number, opacity: number, animate: boolean) {
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ease = animate && !calm ? `${FADE_MS}ms ease-out` : "none";
  document.body.style.transition = ease === "none" ? "none" : `padding-top ${ease}`;
  document.documentElement.style.setProperty("--ptr", `${y}px`);
  disc.style.transition = ease === "none" ? "none" : `opacity ${ease}`;
  disc.style.opacity = String(opacity);
}

/**
 * Pull down from the top of any page to refresh it, the way native apps do (a Home Screen app has no browser to do it).
 * One finger, from a page that is scrolled to the very top, moving down more than sideways: a round indicator follows
 * the finger with growing resistance, its ring filling as you pull; let go past the threshold and the ring turns while
 * the page really refreshes (`router.refresh()`: the server data is fetched again and the page re-rendered, keeping
 * client state such as typed text) until the new page is in, then a check shows briefly. With reduced motion the
 * indicator does not move, scale or turn.
 *
 * It stays out of the way of: a sheet or dialog that is open, text fields, a text selection, rows that scroll sideways
 * (photo strips, card rows), panels scrolled down, a second finger, and anything inside `data-no-pull`.
 * The touchmove listener that can cancel the page's own movement exists only while the page is scrolled to the top,
 * so scrolling elsewhere never waits on it. `body` has `overscroll-behavior-y: none`, so no browser pull-to-refresh or
 * rubber band competes with this one.
 */
export function PullToRefresh() {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [phase, setPhase] = useState<"idle" | "refreshing" | "done">("idle");
  const disc = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLDivElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const busy = useRef(false);
  const startedAt = useRef(0);

  useEffect(() => {
    const el = disc.current;
    const turn = face.current;
    const ring = arc.current;
    if (!el || !turn || !ring) return;

    let finger: { x: number; y: number; base: number | null; crossed: boolean } | null = null;
    let pull = 0;
    let listening = false;

    function hide() {
      if (el && !busy.current) place(el, 0, 0, true);
    }

    function stop(hideIndicator = false) {
      finger = null;
      pull = 0;
      if (listening) {
        document.removeEventListener("touchmove", onMove);
        listening = false;
      }
      if (hideIndicator) hide();
    }

    function onStart(event: TouchEvent) {
      stop(true);
      if (busy.current || event.touches.length !== 1 || !canPullFrom(event.target)) return;
      finger = { x: event.touches[0].clientX, y: event.touches[0].clientY, base: null, crossed: false };
      // Non-passive only during a gesture that started at the top and may become a pull.
      document.addEventListener("touchmove", onMove, { passive: false });
      listening = true;
    }

    function onMove(event: TouchEvent) {
      if (!finger || !el || !turn || !ring) return;
      if (event.touches.length !== 1 || window.scrollY > 0) {
        stop(true);
        return;
      }
      const { clientX: x, clientY: y } = event.touches[0];
      if (finger.base === null) {
        const down = y - finger.y;
        const sideways = Math.abs(x - finger.x);
        // Up, or more sideways than down: not a pull, leave the gesture to the page.
        if (down < -SLOP || (sideways > SLOP && sideways > down)) return stop();
        if (down <= SLOP) return;
        finger.base = y;
      }
      // From here the page does not move: the finger drives the indicator.
      if (event.cancelable) event.preventDefault();
      pull = resist(Math.max(0, y - finger.base));
      const progress = Math.min(1, pull / THRESHOLD);
      ring.style.strokeDasharray = `${Math.round(progress * 100)} 100`;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        place(el, pull > 0 ? REST_Y : 0, pull > 0 ? 1 : 0, false);
      } else {
        place(el, pull, Math.min(1, pull / 24), false);
        turn.style.transform = `scale(${0.8 + 0.2 * progress})`;
      }
      const past = pull >= THRESHOLD;
      if (past && !finger.crossed) haptic("select");
      finger.crossed = past;
    }

    function onEnd(event: TouchEvent) {
      const pulled = finger?.base != null;
      const go = pulled && pull >= THRESHOLD && event.type === "touchend";
      stop();
      if (!pulled) return;
      if (go && navigator.onLine !== false) {
        busy.current = true;
        startedAt.current = performance.now();
        setPhase("refreshing");
        startTransition(() => router.refresh());
      } else {
        hide();
      }
    }

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      document.removeEventListener("touchmove", onMove);
    };
  }, [router, startTransition]);

  // While refreshing the indicator rests at the threshold with a short arc that turns.
  useEffect(() => {
    if (phase !== "refreshing" || !disc.current) return;
    place(disc.current, REST_Y, 1, true);
    if (face.current) face.current.style.transform = "";
    if (arc.current) arc.current.style.strokeDasharray = ARC_REFRESHING;
  }, [phase]);

  // When the new page is in: let lists that keep their own pages start over, show the check once the spinner has been seen long enough.
  useEffect(() => {
    if (phase !== "refreshing" || refreshing) return;
    window.dispatchEvent(new Event(PAGE_REFRESHED_EVENT));
    const timer = setTimeout(() => setPhase("done"), Math.max(0, MIN_SPIN_MS - (performance.now() - startedAt.current)));
    return () => clearTimeout(timer);
  }, [phase, refreshing]);

  // The check shows briefly, then the indicator fades out and the page closes the gap.
  useEffect(() => {
    if (phase !== "done") return;
    const timer = setTimeout(() => {
      busy.current = false;
      setPhase("idle");
      if (disc.current) place(disc.current, 0, 0, true);
      if (face.current) face.current.style.transform = "";
      if (arc.current) arc.current.style.strokeDasharray = ARC_EMPTY;
    }, DONE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const done = phase === "done";
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center" aria-live="polite">
      <div ref={disc} style={{ transform: "translateY(calc(env(safe-area-inset-top) + var(--ptr, 0px) / 2 - 1.125rem))" }} className="opacity-0">
        <div
          ref={face}
          className="relative flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-brand-text shadow-[0_2px_10px_rgba(11,16,26,0.16)] dark:border-zinc-700 dark:bg-zinc-800 dark:shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-6 w-6 fill-none transition-opacity duration-150 motion-reduce:transition-none ${phase === "refreshing" ? "ptr-spin" : ""} ${done ? "opacity-0" : "opacity-100"}`}
            strokeWidth="2.5"
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" pathLength="100" className="stroke-zinc-200 dark:stroke-zinc-700" />
            <circle ref={arc} cx="12" cy="12" r="9" pathLength="100" transform="rotate(-90 12 12)" className="stroke-current" style={{ strokeDasharray: ARC_EMPTY }} />
          </svg>
          {done ? (
            <svg viewBox="0 0 24 24" className="absolute h-6 w-6 fill-none stroke-current" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M7.5 12.5l3 3 6-7" pathLength="1" className="ptr-check" />
            </svg>
          ) : null}
        </div>
        {phase === "refreshing" ? <span className="sr-only">Refreshing</span> : done ? <span className="sr-only">Refreshed</span> : null}
      </div>
    </div>
  );
}
