"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const EVENT = "first-run-strip";

/** One card above the feed for a member who has not posted or messaged yet. "Just looking" hides it for good on this device. */
export function FirstRunStrip({ studentId, displayName }: { studentId: string; displayName: string }) {
  const key = `studiskarte:first-run-dismissed:${studentId}`;
  const dismissed = useSyncExternalStore(
    (onChange) => {
      window.addEventListener(EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => {
      try {
        return window.localStorage.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    () => true, // Nothing on the server: the card appears once the page is in the browser, so it never flashes for someone who dismissed it.
  );

  if (dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // Storage is blocked: the card still goes away until the next visit.
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <section aria-label="Welcome" className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="font-medium">Hi, {displayName}. Selling something or looking for something?</p>
      <Link href="/posts/new" className="flex h-12 items-center justify-center rounded-full bg-brand px-6 font-medium text-white active:opacity-80">
        Post your first item
      </Link>
      <button type="button" onClick={dismiss} className="flex h-11 items-center justify-center self-center px-4 text-sm font-medium underline">
        Just looking
      </button>
    </section>
  );
}
