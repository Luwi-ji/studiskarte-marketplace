"use client";

import { useRef, type ReactNode } from "react";

/**
 * The "⋯" action in the thread header: opens a sheet with Report and Block. The two
 * controls come from the server page and are placed apart, Block last in red, so
 * the destructive one is never next to the safe one.
 */
export function ThreadMenu({ name, report, block }: { name: string; report: ReactNode; block: ReactNode }) {
  const sheet = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => sheet.current?.showModal()}
        aria-label={`Report or block ${name}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl active:opacity-80"
      >
        <span aria-hidden>⋯</span>
      </button>

      <dialog
        ref={sheet}
        aria-label={`Report or block ${name}`}
        className="m-0 mt-auto max-h-[90dvh] w-full max-w-none rounded-t-2xl bg-[var(--background)] p-0 text-[var(--foreground)] backdrop:bg-black/50"
      >
        <div className="mx-auto flex max-h-[90dvh] w-full max-w-md flex-col">
          <div className="flex items-center justify-between px-4 pt-2">
            <h2 className="min-w-0 truncate text-lg font-semibold">{name}</h2>
            <button type="button" onClick={() => sheet.current?.close()} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl">
              ×
            </button>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Something wrong with this person or their messages? Tell the admins.</p>
              {report}
            </div>
            <div className="flex flex-col gap-1 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Block them if you do not want to hear from them again.</p>
              {block}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
