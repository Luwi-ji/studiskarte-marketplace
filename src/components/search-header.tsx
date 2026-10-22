"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { FilterSheet } from "@/app/feed/filter-sheet";
import { SearchBox } from "@/app/feed/search-box";
import { CategoryDrawer, type CategoryLink } from "@/components/category-drawer";

type Option = { id: string; name: string };

export type SearchNav = {
  tabs: { id: string; label: string; href: string; current: boolean }[];
  categories: { allHref: string; allCurrent: boolean; items: CategoryLink[] };
  /** Filters apply to Posts results only; null on People and Schools leaves the button out. */
  filters: { categories: Option[]; schools: Option[]; values: Record<string, string>; keep: Record<string, string>; activeCount: number } | null;
};

const iconButton = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:opacity-80";
// Same underlined tab strip as the feed's.
const tabBase = "relative flex h-11 flex-1 items-center justify-center whitespace-nowrap px-2 text-[13px] font-medium active:opacity-80";
const tabOff = `${tabBase} text-zinc-600 dark:text-zinc-400`;
const tabOn = `${tabBase} font-semibold text-brand-text after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-text`;

/** The Navigation API is not in every TypeScript DOM lib; `canGoBack` only counts entries of this site. */
type NavigationLike = { canGoBack: boolean };

function canGoBackInApp(): boolean {
  const navigation = (window as Window & { navigation?: NavigationLike }).navigation;
  return navigation ? navigation.canGoBack : window.history.length > 1;
}

/**
 * The Search page's pinned top: [back] [menu] [search field] [filters], then the Posts | People | Schools strip.
 * Without `nav` (while the page loads) the field is still usable but the buttons that need data are inert, so the
 * header keeps its size. `enter` fades the page in on arrival.
 */
export function SearchHeader({ nav, q = "", tab = "posts", enter = false }: { nav?: SearchNav; q?: string; tab?: string; enter?: boolean }) {
  const router = useRouter();

  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    // Let a new-tab or new-window click behave as a link.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    if (!canGoBackInApp()) return;
    event.preventDefault();
    router.back();
  }

  return (
    <header
      className={`sticky top-0 z-20 border-b border-zinc-200 bg-[var(--background)] pt-[env(safe-area-inset-top)] dark:border-zinc-800 ${enter ? "transition-opacity duration-150 ease-out starting:opacity-0 motion-reduce:transition-none" : ""}`}
    >
      <h1 className="sr-only">Search</h1>
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center gap-1 px-2 pt-1">
          <Link href="/" onClick={goBack} aria-label="Back" className={iconButton}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M19 12H5m6-6-6 6 6 6" />
            </svg>
          </Link>
          {nav ? (
            <CategoryDrawer {...nav.categories} />
          ) : (
            <button type="button" disabled aria-label="Categories" className={`${iconButton} opacity-60`}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
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
                <Link key={t.id} href={t.href} aria-current={t.current ? "page" : undefined} className={t.current ? tabOn : tabOff}>
                  {t.label}
                </Link>
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
