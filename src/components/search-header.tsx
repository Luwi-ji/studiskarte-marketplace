"use client";

import Link from "next/link";
import { PendingTabLink } from "@/components/pending-nav";
import { FiltersButton } from "@/components/header-sheets";
import { useProvideFilterOptions, type FilterOptions } from "@/components/filter-options";
import { useScrollDirection } from "@/components/use-scroll-direction";
import { SearchBox } from "@/app/feed/search-box";

export type SearchNav = {
  tabs: { id: string; label: string; href: string; current: boolean }[];
  /** Filters apply to Posts results only; null on People and Schools leaves the button out. Options: what the sheet lists, handed over so its first opening needs no fetch. */
  filters: { options: FilterOptions; activeCount: number } | null;
};

const iconButton = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:opacity-80";
// The top row (48 px) and the tab strip slide with `translateY` only; the header keeps its full height, so the page never jumps.
const pinned = "pointer-events-auto bg-[var(--background)] will-change-transform motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out";
// Same underlined tab strip as the feed's; the underline is always there, collapsed, and the current tab grows it.
const tabBase =
  "relative flex h-11 flex-1 items-center justify-center whitespace-nowrap px-2 text-[13px] font-medium transition-colors duration-150 ease-out active:opacity-80 motion-reduce:transition-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:bg-brand-text after:transition-transform after:duration-150 after:ease-out motion-reduce:after:transition-none";
const tabOff = `${tabBase} text-zinc-600 after:scale-x-0 dark:text-zinc-400`;
const tabOn = `${tabBase} font-semibold text-brand-text after:scale-x-100`;

/**
 * The Search page's pinned top: [back] [search field] [filters], then the Posts | People | Schools strip.
 * Back is a plain link to the feed, so it never steps through earlier searches or tabs (they replace each other in
 * the history). Without `nav` (while the page loads) the field and the Filters button are usable all the same (the
 * sheet is owned by `HeaderSheets`) and only the tabs are inert labels. The top row and the tab strip are separate
 * elements. `enter` fades the page in on arrival.
 */
export function SearchHeader({ nav, q = "", tab = "posts", enter = false }: { nav?: SearchNav; q?: string; tab?: string; enter?: boolean }) {
  useProvideFilterOptions(nav?.filters?.options ?? null);
  // A new search or another results tab brings the top row back.
  const { hidden, focusProps } = useScrollDirection(`${tab}:${q}`);
  return (
    <header
      {...focusProps}
      className={`pointer-events-none sticky top-0 z-20 pt-[env(safe-area-inset-top)] ${enter ? "transition-opacity duration-150 ease-out starting:opacity-0 motion-reduce:transition-none" : ""}`}
    >
      {/* The notch area stays covered while the top row has slid away under it. */}
      <div aria-hidden className="absolute inset-x-0 top-0 z-10 h-[env(safe-area-inset-top)] bg-[var(--background)]" />
      <h1 className="sr-only">Search</h1>
      <div inert={hidden} aria-hidden={hidden || undefined} className={`${pinned} ${hidden ? "-translate-y-12" : ""}`}>
        <div className="mx-auto flex w-full max-w-3xl items-center gap-1 px-2 pt-1">
          <Link href="/" aria-label="Back" className={iconButton}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5m6-6-6 6 6 6" />
            </svg>
          </Link>
          <SearchBox key={q} initial={q} tab={tab} />
          {nav && !nav.filters ? null : <FiltersButton activeCount={nav?.filters?.activeCount} />}
        </div>
      </div>

      <div className={`${pinned} border-b border-zinc-200 dark:border-zinc-800 ${hidden ? "-translate-y-12" : ""}`}>
        <nav aria-label="Search results" className="mx-auto flex w-full max-w-3xl px-2">
          {nav
            ? nav.tabs.map((t) => (
                <PendingTabLink key={t.id} id={t.id} href={t.href} replace current={t.current} onClass={tabOn} offClass={tabOff}>
                  {t.label}
                </PendingTabLink>
              ))
            : ["Posts", "People", "Schools"].map((label) => (
                <span key={label} className={`${tabOff} opacity-60`}>
                  {label}
                </span>
              ))}
        </nav>
      </div>
    </header>
  );
}
