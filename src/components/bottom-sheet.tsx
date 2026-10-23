"use client";

import { useRef, type ReactNode } from "react";
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

/**
 * A modal sheet that slides up from the bottom. Close it with Escape, a tap on the dimmed page, or a swipe down with a
 * finger (from the handle bar, a header marked `data-sheet-drag`, or the top of a list that is scrolled to the top).
 * A native <dialog> gives the focus trap. The gesture, the opening and the closing live in `useSlideDialog`. With
 * reduced motion on, it appears and closes without sliding.
 */
export function BottomSheet({ open, onOpenChange, label, returnFocusTo, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const dialogProps = useSlideDialog(ref, { open, onOpenChange, edge: "bottom", ms: 220, closeShare: 0.25, returnFocusTo });

  return (
    <dialog
      ref={ref}
      aria-label={label}
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
