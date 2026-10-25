"use client";

import { NewPostButton } from "@/components/post-chooser";
import { useDismissed } from "@/components/use-dismissed";

/** One card above the feed for a member who has not posted or messaged yet. "Just looking" hides it for good on this device. */
export function FirstRunStrip({ studentId, displayName, canSell = true }: { studentId: string; displayName: string; canSell?: boolean }) {
  const { dismissed, dismiss } = useDismissed(`studiskarte:first-run-dismissed:${studentId}`);
  if (dismissed) return null;

  return (
    <section aria-label="Welcome" className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="font-medium">Hi, {displayName}. Selling something or looking for something?</p>
      <NewPostButton canSell={canSell} className="flex h-12 items-center justify-center rounded-full bg-brand px-6 font-medium text-white active:opacity-80">
        Post your first item
      </NewPostButton>
      <button type="button" onClick={dismiss} className="flex h-11 items-center justify-center self-center px-4 text-sm font-medium underline">
        Just looking
      </button>
    </section>
  );
}
