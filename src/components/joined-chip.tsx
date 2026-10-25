"use client";

import { useEffect, useRef, useState } from "react";
import { STAT_LINK } from "@/components/seller-trust";

const OPEN_AFTER_MS = 500;
const CLOSE_AFTER_MS = 3600;

/**
 * When someone joined, as a small calendar icon at the end of the counts row, sized and spaced like the counts. It opens
 * by itself for a moment when a profile is opened ("Joined October 2026"), then folds back to the icon. Tapping it opens
 * or closes it by hand; once the person has tapped, it no longer moves on its own. With reduced motion it stays folded.
 */
export function JoinedChip({ joinedAt }: { joinedAt: string }) {
  const [open, setOpen] = useState(false);
  const touched = useRef(false);
  const label = new Date(joinedAt).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const opening = window.setTimeout(() => {
      if (!touched.current) setOpen(true);
    }, OPEN_AFTER_MS);
    const closing = window.setTimeout(() => {
      if (!touched.current) setOpen(false);
    }, CLOSE_AFTER_MS);
    return () => {
      window.clearTimeout(opening);
      window.clearTimeout(closing);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        touched.current = true;
        setOpen((was) => !was);
      }}
      aria-expanded={open}
      aria-label={`Joined ${label}`}
      title={`Joined ${label}`}
      className={`${STAT_LINK} gap-1 text-sm`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </svg>
      <span
        aria-hidden
        className={`overflow-hidden whitespace-nowrap font-medium text-zinc-900 transition-[max-width,opacity,margin] duration-300 ease-out motion-reduce:transition-none dark:text-zinc-100 ${open ? "ml-0.5 max-w-44 opacity-100" : "max-w-0 opacity-0"}`}
      >
        Joined {label}
      </span>
    </button>
  );
}
