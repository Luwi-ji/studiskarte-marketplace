"use client";

import { useState, type ReactNode } from "react";

const TONES = {
  // School email is blue, ID checked is green (the owner's colours), in light and dark.
  blue: { chip: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200", bare: "text-blue-700 dark:text-blue-300" },
  green: { chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200", bare: "text-emerald-700 dark:text-emerald-300" },
  // A guest has no school email: neutral grey, not a colour that says "verified".
  grey: { chip: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300", bare: "text-zinc-600 dark:text-zinc-400" },
  // Founding User: gold, because it marks an early member, not a check.
  amber: { chip: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200", bare: "text-amber-700 dark:text-amber-300" },
};

/**
 * A badge shown as a small icon chip. Tapping it widens the chip to show its name in place; tapping again folds it back.
 * `interactive={false}` renders a tooltip-labelled bare icon for rows whose whole surface is already a link.
 */
export function BadgeButton({ title, description, icon, tone, interactive = true }: { title: string; description: string; icon: ReactNode; tone: keyof typeof TONES; interactive?: boolean }) {
  const [open, setOpen] = useState(false);

  if (!interactive) {
    return (
      <span aria-label={`${title}: ${description}`} title={`${title}: ${description}`} className={`inline-flex h-7 w-7 shrink-0 items-center justify-center ${TONES[tone].bare}`}>
        <span className="h-5 w-5">{icon}</span>
      </span>
    );
  }

  return (
    <span onClick={(event) => event.stopPropagation()} className="inline-flex shrink-0">
      <button
        type="button"
        aria-expanded={open}
        title={description}
        onClick={(event) => {
          event.preventDefault();
          setOpen((was) => !was);
        }}
        // The chip is 32 px tall; the pseudo-element grows the tap area to 44 px.
        className={`press relative inline-flex h-8 min-w-8 items-center rounded-full after:absolute after:-inset-1.5 after:content-[''] ${TONES[tone].chip}`}
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center">
          <span className="h-4 w-4">{icon}</span>
        </span>
        {/* Always in the page, so the name is read out; clipped to nothing until the chip is opened. */}
        <span className={`overflow-hidden transition-[max-width,opacity] duration-200 ease-out motion-reduce:transition-none ${open ? "max-w-36 opacity-100" : "max-w-0 opacity-0"}`}>
          <span className="block whitespace-nowrap pr-3 text-sm font-medium">{title}</span>
        </span>
      </button>
    </span>
  );
}
