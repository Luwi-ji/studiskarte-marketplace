"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

const SLIDE_MS = 220;
// Drag past this share of the sheet's height, or flick faster than FLICK px per ms, to close.
const CLOSE_SHARE = 0.25;
const FLICK = 0.6;

const slide = `transform ${SLIDE_MS}ms ease-out`;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Drag = { id: number; startY: number; lastY: number; lastT: number; speed: number };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The sheet's accessible name. */
  label: string;
  /** CSS selector of the button that opens the sheet: it gets focus back on close if the button was replaced while the sheet was open. */
  returnFocusTo?: string;
  children: ReactNode;
};

/**
 * A modal sheet that slides up from the bottom. Close it with Escape, a tap on the dimmed page, or by dragging
 * down on any element marked `data-sheet-drag` (the handle bar and headers). A native <dialog> gives the focus trap
 * and returns focus to the button that opened it. With reduced motion on, it appears and closes without sliding.
 */
export function BottomSheet({ open, onOpenChange, label, returnFocusTo, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: number | undefined;
    if (open) {
      if (!el.open) {
        el.style.transition = "none";
        el.style.transform = "translateY(100%)";
        el.showModal();
        void el.offsetHeight; // commit the start position so the slide has something to animate from
        el.style.transition = reducedMotion() ? "none" : slide;
        el.style.transform = "translateY(0)";
      }
      el.dataset.shown = "true";
    } else if (el.open) {
      el.dataset.shown = "false";
      if (reducedMotion()) el.close();
      else {
        el.style.transition = slide;
        el.style.transform = "translateY(100%)";
        timer = window.setTimeout(() => el.close(), SLIDE_MS + 30);
      }
    }
    return () => window.clearTimeout(timer);
  }, [open]);

  function press(event: ReactPointerEvent<HTMLDialogElement>) {
    const el = ref.current;
    const target = event.target as HTMLElement;
    if (!el || drag.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (!target.closest("[data-sheet-drag]") || target.closest("button, a, input, select, textarea")) return;
    drag.current = { id: event.pointerId, startY: event.clientY, lastY: event.clientY, lastT: event.timeStamp, speed: 0 };
    el.setPointerCapture(event.pointerId);
    el.style.transition = "none";
  }

  function move(event: ReactPointerEvent<HTMLDialogElement>) {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d || d.id !== event.pointerId) return;
    const dt = event.timeStamp - d.lastT;
    if (dt > 0) d.speed = (event.clientY - d.lastY) / dt;
    d.lastY = event.clientY;
    d.lastT = event.timeStamp;
    el.style.transform = `translateY(${Math.max(0, event.clientY - d.startY)}px)`;
  }

  function release(event: ReactPointerEvent<HTMLDialogElement>) {
    const el = ref.current;
    const d = drag.current;
    if (!el || !d || d.id !== event.pointerId) return;
    drag.current = null;
    const dy = Math.max(0, event.clientY - d.startY);
    const cancelled = event.type === "pointercancel";
    if (!cancelled && (dy > el.offsetHeight * CLOSE_SHARE || (d.speed > FLICK && dy > 8))) {
      onOpenChange(false);
    } else {
      el.style.transition = reducedMotion() ? "none" : slide;
      el.style.transform = "translateY(0)";
    }
  }

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClose={() => {
        onOpenChange(false);
        if (returnFocusTo && (!document.activeElement || document.activeElement === document.body)) document.querySelector<HTMLElement>(returnFocusTo)?.focus();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
      onPointerDown={press}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
      className="mx-auto mb-0 mt-auto max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border-0 bg-[var(--background)] p-0 text-[var(--foreground)] open:flex backdrop:bg-black/50 backdrop:opacity-0 backdrop:transition-opacity backdrop:duration-200 data-[shown=true]:backdrop:opacity-100 motion-reduce:backdrop:transition-none"
    >
      <div data-sheet-drag className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center">
        <span aria-hidden className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
      </div>
      {children}
    </dialog>
  );
}
