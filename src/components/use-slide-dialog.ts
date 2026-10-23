"use client";

import { useEffect, useLayoutEffect, useRef, type MouseEvent as ReactMouseEvent, type RefObject } from "react";

// Slide the other way past this share of the panel's size, or flick faster than FLICK px per ms, to close.
const FLICK = 0.5;
// A touch that moves less than this is a tap (fingers always wobble): it is never treated as a swipe and never cancelled.
const SLOP = 10;
// A click on the dimmed page this soon after the panel opened is a stale tap from the button that opened it.
const GHOST_MS = 400;

type Edge = "bottom" | "left";

const HIDDEN: Record<Edge, string> = { bottom: "translateY(100%)", left: "translateX(-100%)" };
const SHOWN: Record<Edge, string> = { bottom: "translateY(0)", left: "translateX(0)" };
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Modal if the browser can; a plain `open` dialog (still shown, no dimmed page or focus trap) if it cannot. */
function showDialog(el: HTMLDialogElement, edge: Edge) {
  if (typeof el.showModal === "function") {
    try {
      el.showModal();
      return;
    } catch {
      // Already open as a plain dialog, or detached: use the attribute below.
    }
  }
  el.setAttribute("open", "");
  el.style.position = "fixed";
  el.style.zIndex = "60";
  if (edge === "bottom") Object.assign(el.style, { left: "0", right: "0", bottom: "0" });
}

function closeDialog(el: HTMLDialogElement) {
  if (typeof el.close === "function") el.close();
  else {
    el.removeAttribute("open");
    el.dispatchEvent(new Event("close"));
  }
}

type Options = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The side the panel slides in from; swiping back towards it closes. */
  edge: Edge;
  /** Slide time, ms. */
  ms: number;
  /** Share of the panel's size a swipe must pass to close. */
  closeShare: number;
  /** CSS selector of the button that opens the panel: it gets focus back on a keyboard close if the button was replaced meanwhile. */
  returnFocusTo?: string;
};

/**
 * Everything a sliding native <dialog> panel (bottom sheet, side drawer) needs, so both behave the same:
 *
 * - Opening shows the dialog in the same commit as the state change (`showModal`, or the `open` attribute when the
 *   browser has no `showModal`), then slides it in. A panel that ends up open but off screen is put back.
 * - Closing slides out (nothing with reduced motion), then closes the dialog. Reopening mid-slide just slides back in.
 * - Swiping back towards the edge, with TOUCH events only, closes it: it follows the finger once the finger has moved
 *   past a tap's wobble, and closes past `closeShare` or on a flick, else springs back. A tap is never intercepted.
 *   A swipe may start in the header zones (`[data-sheet-drag]`, `touch-action: none`) or, for the bottom sheet, inside
 *   a scrolling body that is scrolled to the top.
 * - A tap on the dimmed page closes it only if the touch started there too and the panel is not brand new (ghost clicks).
 * - Focus goes to the dialog itself (no ring) for pointer users, so no button looks selected; keyboard users get the
 *   usual first control and their focus back on close.
 */
export function useSlideDialog(ref: RefObject<HTMLDialogElement | null>, { open, onOpenChange, edge, ms, closeShare, returnFocusTo }: Options) {
  const latest = useRef({ open, onOpenChange });
  const openedAt = useRef(0);
  // Whether the last thing the user did was press a key (not touch or click): decides who gets a focus ring and focus back.
  const keyboard = useRef(false);
  const downOnBackdrop = useRef(false);

  useLayoutEffect(() => {
    latest.current = { open, onOpenChange };
  });

  useEffect(() => {
    const key = () => {
      keyboard.current = true;
    };
    const pointer = () => {
      keyboard.current = false;
    };
    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("touchstart", pointer, { capture: true, passive: true });
    return () => {
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("touchstart", pointer, true);
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const slide = reducedMotion() ? "none" : `transform ${ms}ms ease-out`;
    let timer: number | undefined;
    let check: number | undefined;
    if (open) {
      if (!el.open) {
        openedAt.current = performance.now();
        el.style.transition = "none";
        el.style.transform = HIDDEN[edge];
        showDialog(el, edge);
        void el.offsetWidth; // commit the start position so the slide has something to animate from
        // Pointer users: the dialog itself holds focus, so no button shows a ring.
        if (!keyboard.current) el.focus({ preventScroll: true });
      }
      el.dataset.shown = "true";
      el.style.transition = slide;
      el.style.transform = SHOWN[edge];
      // If the slide never happened (a browser that skips it), make sure the panel is where it should be.
      check = window.setTimeout(() => {
        if (!el.open) return;
        const box = el.getBoundingClientRect();
        if (edge === "bottom" ? box.top >= window.innerHeight - 1 : box.right <= 1) {
          el.style.transition = "none";
          el.style.transform = SHOWN[edge];
        }
      }, ms + 80);
    } else if (el.open) {
      el.dataset.shown = "false";
      if (slide === "none") closeDialog(el);
      else {
        el.style.transition = slide;
        el.style.transform = HIDDEN[edge];
        timer = window.setTimeout(() => closeDialog(el), ms + 30);
      }
    }
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(check);
    };
  }, [open, ref, edge, ms]);

  // The swipe. Native listeners: `touchmove` must be non-passive to be able to hold the page still once a swipe starts.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const el: HTMLDialogElement = node;
    type Sample = { p: number; t: number };
    type Gesture = { x0: number; y0: number; samples: Sample[]; dragging: boolean; dead: boolean; offset: number };
    let g: Gesture | null = null;
    const slide = () => (reducedMotion() ? "none" : `transform ${ms}ms ease-out`);
    const place = (offset: number) => {
      el.style.transform = edge === "bottom" ? `translateY(${offset}px)` : `translateX(${-offset}px)`;
    };
    const springBack = () => {
      el.style.transition = slide();
      el.style.transform = SHOWN[edge];
    };

    /** Is every scrolling ancestor between the touch and the dialog at its top? */
    function atTop(from: Element) {
      for (let n: Element | null = from; n && n !== el; n = n.parentElement) {
        if (n.scrollTop > 0 && n.scrollHeight > n.clientHeight) {
          const overflow = getComputedStyle(n).overflowY;
          if (overflow === "auto" || overflow === "scroll") return false;
        }
      }
      return true;
    }

    /** px per ms over the last 100 ms of the touch. */
    function speedOf(samples: Sample[]) {
      const last = samples[samples.length - 1];
      const first = samples.find((s) => last.t - s.t <= 100) ?? last;
      return last.t > first.t ? (last.p - first.p) / (last.t - first.t) : 0;
    }

    function start(event: TouchEvent) {
      g = null;
      if (event.touches.length !== 1 || !el.open || !latest.current.open) return;
      const target = event.target;
      if (!(target instanceof Element) || target.closest('input[type="range"], [data-no-swipe]')) return;
      if (edge === "bottom" && target.closest("[data-sheet-drag]") === null && !atTop(target)) return;
      const touch = event.touches[0];
      g = { x0: touch.clientX, y0: touch.clientY, samples: [{ p: 0, t: event.timeStamp }], dragging: false, dead: false, offset: 0 };
    }

    function move(event: TouchEvent) {
      if (!g || g.dead) return;
      if (event.touches.length !== 1) {
        if (g.dragging) springBack();
        g = null;
        return;
      }
      const touch = event.touches[0];
      const along = edge === "bottom" ? touch.clientY - g.y0 : g.x0 - touch.clientX;
      const across = Math.abs(edge === "bottom" ? touch.clientX - g.x0 : touch.clientY - g.y0);
      g.samples.push({ p: along, t: event.timeStamp });
      if (!g.dragging) {
        if (Math.hypot(along, across) < SLOP) return; // still a tap
        if (along > 0 && along > across) {
          g.dragging = true;
          el.style.transition = "none";
        } else {
          g.dead = true; // the other way, or sideways: the page's own scroll, not ours
          return;
        }
      }
      if (event.cancelable) event.preventDefault();
      g.offset = Math.max(0, along - SLOP);
      place(g.offset);
    }

    function end(event: TouchEvent) {
      const done = g;
      g = null;
      if (!done || !done.dragging) return; // a tap or a scroll: nothing of ours to finish
      const size = edge === "bottom" ? el.offsetHeight : el.offsetWidth;
      if (event.type === "touchend" && (done.offset > size * closeShare || (speedOf(done.samples) > FLICK && done.offset > 8))) latest.current.onOpenChange(false);
      else springBack();
    }

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end, { passive: true });
    el.addEventListener("touchcancel", end, { passive: true });
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [ref, edge, ms, closeShare]);

  /** Does the point lie on the dimmed page (outside the panel)? Clicks on the backdrop are reported on the dialog. */
  function onBackdrop(target: EventTarget, currentTarget: HTMLDialogElement, x: number, y: number) {
    if (target !== currentTarget) return false;
    const box = currentTarget.getBoundingClientRect();
    return x < box.left || x > box.right || y < box.top || y > box.bottom;
  }

  return {
    tabIndex: -1,
    onCancel(event: { preventDefault(): void }) {
      event.preventDefault();
      onOpenChange(false);
    },
    onClose() {
      const el = ref.current;
      if (el?.open) return; // reopened before this event arrived
      onOpenChange(false);
      const trigger = returnFocusTo ? document.querySelector<HTMLElement>(returnFocusTo) : null;
      if (keyboard.current) {
        if (trigger && (!document.activeElement || document.activeElement === document.body)) trigger.focus();
      } else if (trigger && document.activeElement === trigger) trigger.blur(); // no ring on a button that was only tapped
    },
    onPointerDown(event: { target: EventTarget; currentTarget: HTMLDialogElement; clientX: number; clientY: number }) {
      downOnBackdrop.current = onBackdrop(event.target, event.currentTarget, event.clientX, event.clientY);
    },
    onTouchStart(event: { target: EventTarget; currentTarget: HTMLDialogElement; touches: { length: number; [i: number]: { clientX: number; clientY: number } } }) {
      const touch = event.touches[0];
      if (touch) downOnBackdrop.current = onBackdrop(event.target, event.currentTarget, touch.clientX, touch.clientY);
    },
    onClick(event: ReactMouseEvent<HTMLDialogElement>) {
      const startedOnBackdrop = downOnBackdrop.current;
      downOnBackdrop.current = false;
      if (!startedOnBackdrop || !onBackdrop(event.target, event.currentTarget, event.clientX, event.clientY)) return;
      if (performance.now() - openedAt.current < GHOST_MS) return;
      onOpenChange(false);
    },
  };
}
