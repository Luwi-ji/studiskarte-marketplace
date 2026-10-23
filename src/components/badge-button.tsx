"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BottomSheet } from "@/components/bottom-sheet";

/**
 * A badge shown as a bare icon. Tapping it opens a small bottom sheet with its title and one plain sentence.
 * `interactive={false}` renders a tooltip-labelled icon for rows whose whole surface is already a link.
 */
export function BadgeButton({ title, description, icon, className, interactive = true }: { title: string; description: string; icon: ReactNode; className: string; interactive?: boolean }) {
  const [open, setOpen] = useState(false);
  // Kept in the page after its first opening so the sheet can slide out instead of vanishing.
  const [shown, setShown] = useState(false);

  if (!interactive) {
    return <span aria-label={`${title}: ${description}`} title={`${title}: ${description}`} className={`inline-flex h-7 w-7 shrink-0 items-center justify-center ${className}`}>{icon}</span>;
  }

  return (
    <span onClick={(event) => event.stopPropagation()} className="inline-flex shrink-0">
      <button
        type="button"
        aria-label={`${title}, more info`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          setShown(true);
          setOpen(true);
        }}
        className={`press -mx-1.5 -my-3 inline-flex h-11 w-11 items-center justify-center rounded-full ${className}`}
      >
        <span className="inline-flex h-5 w-5 items-center justify-center">{icon}</span>
      </button>
      {shown
        ? createPortal(
            <BottomSheet open={open} onOpenChange={setOpen} label={title}>
              <div className="flex flex-col gap-1 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <div data-sheet-drag className="flex min-h-12 items-center gap-3">
                  <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center ${className}`}>{icon}</span>
                  <h2 className="min-w-0 flex-1 text-lg font-semibold">{title}</h2>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="press -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
                <p className="text-base text-zinc-700 dark:text-zinc-300">{description}</p>
              </div>
            </BottomSheet>,
            document.body,
          )
        : null}
    </span>
  );
}
