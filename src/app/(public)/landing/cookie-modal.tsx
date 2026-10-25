"use client";

import { useEffect, useRef, useState } from "react";
import { CONSENT_REOPEN_EVENT, readConsent, saveConsent, type ConsentChoice } from "@/lib/funnel/consent";

/**
 * Asks once what the page may remember. Essential storage (signing in, light or dark mode) is always on and not a choice;
 * the campaign cookie and the visit count only start after "Accept". The footer button asks again.
 */
export function CookieModal() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [current, setCurrent] = useState<ConsentChoice | null>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const existing = readConsent();
    setCurrent(existing);
    if (!existing) el.showModal();
    const reopen = () => {
      setCurrent(readConsent());
      if (!el.open) el.showModal();
    };
    window.addEventListener(CONSENT_REOPEN_EVENT, reopen);
    return () => window.removeEventListener(CONSENT_REOPEN_EVENT, reopen);
  }, []);

  function choose(choice: ConsentChoice) {
    saveConsent(choice);
    setCurrent(choice);
    dialog.current?.close();
  }

  return (
    <dialog
      ref={dialog}
      // Not dismissed by Escape or a tap outside: the visitor answers.
      onCancel={(event) => event.preventDefault()}
      aria-labelledby="cookie-title"
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border-0 bg-[var(--background)] p-0 text-[var(--foreground)] shadow-2xl backdrop:bg-black/60 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex flex-col gap-2">
          <h2 id="cookie-title" className="text-2xl font-bold tracking-tight">
            Cookies and your choice
          </h2>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            We use the least we need. You decide about the one extra: measuring how people find us.
          </p>
        </div>

        <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          <li className="flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">Essential</p>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">Always on</span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Keeps you signed in after you log in, and remembers light or dark mode. The site cannot work without it.</p>
          </li>
          <li className="flex flex-col gap-1 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">Measuring visits</p>
              <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand-text">{current === "accepted" ? "On" : "Your choice"}</span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Counts your visit and, if the link you used was tagged (for example from Instagram), remembers that tag for 7 days so we know which post brought you. No ads, no selling, no name or email attached.
            </p>
          </li>
        </ul>

        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <button type="button" onClick={() => choose("accepted")} className="press flex min-h-12 flex-1 items-center justify-center rounded-full bg-brand px-6 text-base font-semibold text-white">
            Accept
          </button>
          <button type="button" onClick={() => choose("rejected")} className="press flex min-h-12 flex-1 items-center justify-center rounded-full border border-zinc-300 px-6 text-base font-semibold dark:border-zinc-700">
            Reject
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** A footer button that opens the cookie choice again. */
export function CookieSettingsButton({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(CONSENT_REOPEN_EVENT))} className={className}>
      Cookie settings
    </button>
  );
}
