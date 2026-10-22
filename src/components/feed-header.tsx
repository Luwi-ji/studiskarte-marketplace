"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { PendingTabLink, useShownTab } from "@/components/pending-nav";
import { CategoriesButton, FiltersButton } from "@/components/header-sheets";
import { useScrollDirection } from "@/components/use-scroll-direction";
import { useProvideFilterOptions, type FilterOptions } from "@/components/filter-options";

export type FeedTab = { id: string; label: string; href: string; current: boolean };

export type FeedNav = {
  tabs: FeedTab[];
  /** A school chosen in Filters other than the member's own (or several): shown as a fifth tab that clears it. */
  schoolChip: FeedTab | null;
  /** What the drawer and the Filters sheet list, handed over so their first opening needs no fetch; and the count for the Filters badge. */
  filters: { options: FilterOptions; activeCount: number };
};

const iconButton = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:opacity-80";
// The top row (48 px) and the tab strip slide with `translateY` only; the header keeps its full height, so the page never jumps.
const pinned = "pointer-events-auto bg-[var(--background)] will-change-transform motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out";
// The underline is always there, collapsed; the current tab grows it (under 150 ms, not at all with reduced motion).
const tabBase =
  "relative flex h-11 items-center justify-center whitespace-nowrap px-2 text-[13px] font-medium transition-colors duration-150 ease-out active:opacity-80 motion-reduce:transition-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:bg-brand-text after:transition-transform after:duration-150 after:ease-out motion-reduce:after:transition-none";
const tabOff = `${tabBase} text-zinc-600 after:scale-x-0 dark:text-zinc-400`;
const tabOn = `${tabBase} font-semibold text-brand-text after:scale-x-100`;

/**
 * The feed's pinned top: [menu] [search] [hearts] [bell], then the tab strip with the Filters button at its right end.
 * Without `nav` (while the feed loads) the tabs are inert labels, but the menu and Filters buttons work exactly as with
 * it: they open the drawer and the sheet (owned by `HeaderSheets`) at once. The top row and the tab strip are separate
 * elements.
 */
export function FeedHeader({ bell, nav }: { bell: ReactNode; nav?: FeedNav }) {
  const strip = useRef<HTMLElement>(null);
  useProvideFilterOptions(nav?.filters.options ?? null);
  const currentId = useShownTab(nav?.schoolChip?.current ? nav.schoolChip.id : nav?.tabs.find((tab) => tab.current)?.id);
  // A tab change brings the top row back.
  const { hidden, focusProps } = useScrollDirection(currentId ?? "");

  // On a narrow phone the strip scrolls: bring the current tab into view when it changes.
  useEffect(() => {
    const el = strip.current;
    const tab = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !tab) return;
    el.scrollLeft = Math.max(0, tab.offsetLeft - (el.clientWidth - tab.offsetWidth) / 2);
  }, [currentId]);

  return (
    <header {...focusProps} className="pointer-events-none sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
      {/* The notch area stays covered while the top row has slid away under it. */}
      <div aria-hidden className="absolute inset-x-0 top-0 z-10 h-[env(safe-area-inset-top)] bg-[var(--background)]" />
      <h1 className="sr-only">Studiskarte</h1>
      <div inert={hidden} aria-hidden={hidden || undefined} className={`${pinned} ${hidden ? "-translate-y-12" : ""}`}>
        <div className="mx-auto flex w-full max-w-3xl items-center gap-1 px-2 pt-1">
          <CategoriesButton />
          <Link href="/search" className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg bg-zinc-100 px-3 text-zinc-500 dark:bg-zinc-900">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <span className="truncate">Search</span>
          </Link>
          <Link href="/me/hearts" aria-label="Hearted posts" className={iconButton}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z" />
            </svg>
          </Link>
          {bell}
        </div>
      </div>

      <div className={`${pinned} border-b border-zinc-200 dark:border-zinc-800 ${hidden ? "-translate-y-12" : ""}`}>
        <div className="mx-auto flex w-full max-w-3xl items-center pl-2 pr-2">
          <nav ref={strip} aria-label="Show posts from" className="relative flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {nav ? (
              <>
                {nav.tabs.map((tab) => (
                  <PendingTabLink key={tab.id} id={tab.id} href={tab.href} current={tab.current} onClass={`flex-1 ${tabOn}`} offClass={`flex-1 ${tabOff}`}>
                    {tab.label}
                  </PendingTabLink>
                ))}
                {nav.schoolChip ? (
                  <PendingTabLink
                    id={nav.schoolChip.id}
                    goesTo={nav.schoolChip.current ? "all" : (nav.tabs.find((tab) => tab.current)?.id ?? "all")}
                    href={nav.schoolChip.href}
                    current={nav.schoolChip.current}
                    onClass={`max-w-44 shrink-0 gap-1.5 ${tabOn}`}
                    offClass={`max-w-44 shrink-0 gap-1.5 ${tabOff}`}
                  >
                    <span className="truncate">{nav.schoolChip.label}</span>
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                    <span className="sr-only">, show all schools</span>
                  </PendingTabLink>
                ) : null}
              </>
            ) : (
              ["My school", "All schools", "Showcase", "Wishlist"].map((label) => (
                <span key={label} className={`flex-1 ${tabOff} opacity-60`}>
                  {label}
                </span>
              ))
            )}
          </nav>
          <FiltersButton activeCount={nav?.filters.activeCount} />
        </div>
      </div>
    </header>
  );
}
