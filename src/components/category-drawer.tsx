"use client";

import Link from "next/link";
import { useRef } from "react";

export type CategoryLink = { id: string; name: string; href: string; current: boolean };

type Props = {
  /** The feed with no category chosen. */
  allHref: string;
  allCurrent: boolean;
  items: CategoryLink[];
};

const row = "flex h-12 w-full items-center justify-between gap-3 border-b border-zinc-200 px-4 active:bg-zinc-100 dark:border-zinc-800 dark:active:bg-zinc-800";

/**
 * The hamburger button and the left slide-over it opens: "All categories", then each category, the chosen ones
 * marked. A native modal dialog, so it traps focus, closes on Escape and gives focus back to the button; it also
 * closes on a tap of the dimmed page, the Close button or a row.
 */
export function CategoryDrawer({ allHref, allCurrent, items }: Props) {
  const drawer = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => drawer.current?.close();

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label="Categories"
        aria-haspopup="dialog"
        onClick={() => drawer.current?.showModal()}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:opacity-80"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <dialog
        ref={drawer}
        aria-label="Browse by categories"
        onClose={() => trigger.current?.focus()}
        // The dimmed page behind the drawer is the dialog itself as far as a click is concerned.
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none bg-[var(--background)] p-0 text-[var(--foreground)] shadow-xl transition-transform duration-150 ease-out backdrop:bg-black/50 motion-reduce:transition-none starting:open:-translate-x-full"
      >
        <div className="flex h-full flex-col pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between gap-2 pl-4 pr-2 pt-2">
            <h2 className="min-w-0 truncate text-lg font-semibold">Browse by categories</h2>
            <button type="button" onClick={close} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:opacity-80">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <ul className="mt-2 flex-1 overflow-y-auto overscroll-contain border-t border-zinc-200 pb-[env(safe-area-inset-bottom)] dark:border-zinc-800">
            <li>
              <DrawerRow href={allHref} current={allCurrent} onPick={close}>
                All categories
              </DrawerRow>
            </li>
            {items.map((item) => (
              <li key={item.id}>
                <DrawerRow href={item.href} current={item.current} onPick={close}>
                  {item.name}
                </DrawerRow>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}

function DrawerRow({ href, current, onPick, children }: { href: string; current: boolean; onPick: () => void; children: string }) {
  return (
    <Link href={href} onClick={onPick} aria-current={current ? "true" : undefined} className={`${row} ${current ? "font-semibold text-brand-text" : ""}`}>
      <span className="min-w-0 truncate">{children}</span>
      {current ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      ) : null}
    </Link>
  );
}
