"use client";

import Link from "next/link";
import { useDismissed } from "@/components/use-dismissed";

/**
 * One card above the feed for a Guest: are you a student? Yes goes to the school-email step. "No, I'm not" hides it for
 * good on this device; a Guest without a school simply has none shown anywhere.
 */
export function StudentAskStrip({ studentId }: { studentId: string }) {
  const { dismissed, dismiss } = useDismissed(`studiskarte:student-ask-dismissed:${studentId}`);
  if (dismissed) return null;
  return (
    <section aria-label="Are you a student?" className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-1">
        <p className="font-medium">Are you a student?</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Add your school email to sell, claim perks and show your school.</p>
      </div>
      <div className="flex gap-2">
        <Link href="/me/settings/school-email" className="flex h-11 flex-1 items-center justify-center rounded-full bg-brand px-4 text-sm font-semibold text-white active:opacity-80">
          Yes, add my school email
        </Link>
        <button type="button" onClick={dismiss} className="h-11 shrink-0 rounded-full border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700">
          No
        </button>
      </div>
    </section>
  );
}
