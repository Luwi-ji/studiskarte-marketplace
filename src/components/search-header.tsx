"use client";

import Link from "next/link";
import { PendingTabLink } from "@/components/pending-nav";
import { FilterSheet } from "@/app/feed/filter-sheet";
import { SearchBox } from "@/app/feed/search-box";

type Option = { id: string; name: string };

export type SearchNav = {
  tabs: { id: string; label: string; href: string; current: boolean }[];
  /** Filters apply to Posts results only; null on People and Schools leaves the button out. */
  filters: { categories: Option[]; schools: Option[]; values: Record<string, string>; keep: Record<string, string>; activeCount: number } | null;
};

const iconButton = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:opacity-80";
// Same underlined tab strip as the feed's; the underline is always there, collapsed, and the current tab grows it.
const tabBase =
  "relative flex h-11 flex-1 items-center justify-center whitespace-nowrap px-2 text-[13px] font-medium transition-colors duration-150 ease-out active:opacity-80 motion-reduce:transition-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:bg-brand-text after:transition-transform after:duration-150 after:ease-out motion-reduce:after:transition-none";
const tabOff = `${tabBase} text-zinc-600 after:scale-x-0 dark:text-zinc-400`;
const tabOn = `${tabBase} font-semibold text-brand-text after:scale-x-100`;

/**
 * The Search page's pinned top: [back] [search field] [filters], then the Posts | People | Schools strip.
 * Back is a plain link to the feed, so it never steps through earlier searches or tabs (they replace each other in
 * the history). Without `nav` (while the page loads) the field is still usable but the buttons that need data are
 * inert, so the header keeps its size. `enter` fades the page in on arrival.
 */
export function SearchHeader({ nav, q = "", tab = "posts", enter = false }: { nav?: SearchNav; q?: string; tab?: string; enter?: boolean }) {
  return (
    <header
      className={`sticky top-0 z-20 border-b border-zinc-200 bg-[var(--background)] pt-[env(safe-area-inset-top)] dark:border-zinc-800 ${enter ? "transition-opacity duration-150 ease-out starting:opacity-0 motion-reduce:transition-none" : ""}`}
    >
      <h1 className="sr-only">Search</h1>
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center gap-1 px-2 pt-1">
          <Link href="/" aria-label="Back" className={iconButton}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5m6-6-6 6 6 6" />
            </svg>
          </Link>
          <SearchBox key={q} initial={q} tab={tab} />
          {nav?.filters ? (
            <FilterSheet
              variant="icon"
              action="/search"
              categories={nav.filters.categories}
              schools={nav.filters.schools}
              values={nav.filters.values}
              keep={nav.filters.keep}
              activeCount={nav.filters.activeCount}
            />
          ) : nav ? null : (
            <span aria-hidden className="h-11 w-11 shrink-0" />
          )}
        </div>

        <nav aria-label="Search results" className="flex px-2">
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
