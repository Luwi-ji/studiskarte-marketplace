"use client";

import { useState } from "react";

/** When someone joined, as a small calendar icon beside the other counts. Tapping it opens the month and year in place; tapping again folds it back. */
export function JoinedChip({ joinedAt }: { joinedAt: string }) {
  const [open, setOpen] = useState(false);
  const label = new Date(joinedAt).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" });
  return (
    <button
      type="button"
      onClick={() => setOpen((was) => !was)}
      aria-expanded={open}
      aria-label={`Joined ${label}`}
      title={`Joined ${label}`}
      className="press relative inline-flex min-h-6 items-center gap-1 rounded-full text-sm text-zinc-600 after:absolute after:-inset-2 after:content-[''] dark:text-zinc-400"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </svg>
      <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ease-out motion-reduce:transition-none ${open ? "max-w-40 opacity-100" : "max-w-0 opacity-0"}`}>Joined {label}</span>
    </button>
  );
}
