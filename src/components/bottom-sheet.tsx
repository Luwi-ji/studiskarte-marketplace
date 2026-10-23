"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import { createPortal } from "react-dom";
import { useSlideDialog } from "@/components/use-slide-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The sheet's accessible name. */
  label: string;
  /** CSS selector of the button that opens the sheet: it gets focus back on a keyboard close if the button was replaced while the sheet was open. */
  returnFocusTo?: string;
  children: ReactNode;
};

// Once a browser has shown that its <dialog> does not appear, every later sheet in this page load goes straight to the overlay.
let dialogDoesNotShow = false;

/** Is the dialog open and really on screen, with its own content under the middle of its top edge? */
function visiblyOpen(el: HTMLDialogElement): boolean {
  if (!el.open) return false;
  const box = el.getBoundingClientRect();
  if (box.height < 40 || box.top > window.innerHeight - 40 || getComputedStyle(el).visibility === "hidden") return false;
  const hit = document.elementFromPoint(Math.min(window.innerWidth - 1, box.left + box.width / 2), Math.min(window.innerHeight - 1, box.top + 30));
  return hit !== null && el.contains(hit);
}

/**
 * A modal sheet that slides up from the bottom. Close it with Escape, a tap on the dimmed page, or a swipe down with a
 * finger (from the handle bar, a header marked `data-sheet-drag`, or the top of a list that is scrolled to the top).
 * A native <dialog> gives the focus trap. The gesture, the opening and the closing live in `useSlideDialog`.
 *
 * Safety net: if the dialog is opened but does not actually appear on screen (a browser quirk that cannot be seen from
 * a desktop), the sheet is shown as a plain fixed overlay instead, the same content with the same Escape and tap-outside
 * closing, and stays that way for the rest of the page load. The filter button must always show something.
 */
export function BottomSheet({ open, onOpenChange, label, returnFocusTo, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [overlay, setOverlay] = useState(dialogDoesNotShow);
  const dialogProps = useSlideDialog(ref, { open: open && !overlay, onOpenChange, edge: "bottom", ms: 220, closeShare: 0.25, returnFocusTo });

  // After opening, check that the panel really is on screen; if not, switch to the overlay.
  useEffect(() => {
    if (!open || overlay) return;
    const timer = window.setTimeout(() => {
      const el = ref.current;
      if (el && !visiblyOpen(el)) {
        console.error("The sheet's dialog did not appear; showing it as an overlay instead.");
        Sentry.captureMessage("Sheet dialog did not appear; overlay used", { level: "warning", tags: { sheet: label } });
        dialogDoesNotShow = true;
        // Not el.close(): that would report the sheet as closed. Unmounting the dialog removes it from the top layer.
        setOverlay(true);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [open, overlay, label]);

  // Overlay mode: Escape closes it and the page behind does not scroll.
  useEffect(() => {
    if (!overlay || !open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      html.style.overflow = before;
    };
  }, [overlay, open, onOpenChange]);

  if (overlay) {
    if (!open) return null;
    return createPortal(
      <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[80] flex flex-col justify-end">
        <button type="button" aria-label="Close" tabIndex={-1} onClick={() => onOpenChange(false)} className="absolute inset-0 bg-black/50" />
        <div className="relative mx-auto flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-[var(--background)] text-[var(--foreground)] shadow-xl">
          <div className="flex h-6 shrink-0 items-center justify-center">
            <span aria-hidden className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          </div>
          {children}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <dialog
      ref={ref}
      aria-label={label}
      data-slide="bottom"
      {...dialogProps}
      className="mx-auto mb-0 mt-auto max-h-[90dvh] w-full max-w-md touch-pan-y flex-col overflow-hidden rounded-t-2xl border-0 bg-[var(--background)] p-0 text-[var(--foreground)] outline-none open:flex backdrop:bg-black/50 backdrop:opacity-0 backdrop:transition-opacity backdrop:duration-200 data-[shown=true]:backdrop:opacity-100 motion-reduce:backdrop:transition-none"
    >
      <div data-sheet-drag className="flex h-6 shrink-0 touch-none items-center justify-center">
        <span aria-hidden className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
      </div>
      {children}
    </dialog>
  );
}
