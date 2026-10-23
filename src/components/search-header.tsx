"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PendingTabLink, useNavigate, useShownTab } from "@/components/pending-nav";
import { FiltersButton } from "@/components/header-sheets";
import { useProvideFilterOptions, type FilterOptions } from "@/components/filter-options";
import { useScrollDirection } from "@/components/use-scroll-direction";
import { SlidersIcon } from "@/app/feed/filter-sheet";
import { SearchBox } from "@/app/feed/search-box";
import { resultsSkeletons } from "@/components/skeletons";
import { resultsKindFor, type ResultsKind } from "@/lib/discovery/results-kind";

export type SearchNav = {
  tabs: { id: string; label: string; href: string; current: boolean }[];
  /** Filters apply to Posts results only: null on People and Schools, where the button stays (so the field never changes width) but is dimmed and leads back to Posts. Options: what the sheet lists, handed over so its first opening needs no fetch. */
  filters: { options: FilterOptions; activeCount: number } | null;
};

const TAB_LABELS = [
  { id: "posts", label: "Posts" },
  { id: "people", label: "People" },
  { id: "schools", label: "Schools" },
] as const;

const iconButton = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:opacity-80";
// The top row (48 px) and the tab strip slide with `translateY` only; the header keeps its full height, so the page never jumps.
const pinned = "pointer-events-auto bg-[var(--background)] will-change-transform motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out";
// Same underlined tab strip as the feed's; the underline is always there, collapsed, and the current tab grows it.
const tabBase =
  "relative flex h-11 flex-1 items-center justify-center whitespace-nowrap px-2 text-[13px] font-medium transition-colors duration-150 ease-out active:opacity-80 motion-reduce:transition-none after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:origin-center after:rounded-full after:bg-brand-text after:transition-transform after:duration-150 after:ease-out motion-reduce:after:transition-none";
const tabOff = `${tabBase} text-zinc-600 after:scale-x-0 dark:text-zinc-400`;
const tabOn = `${tabBase} font-semibold text-brand-text after:scale-x-100`;

/** Where the Posts tab goes from a search with this query. */
function postsHref(q: string) {
  const params = new URLSearchParams(q ? { q, tab: "posts" } : { tab: "posts" });
  return `/search?${params}`;
}

/**
 * The Filters button where Filters do not apply (People and Schools). It keeps the Filters button's place and size, so
 * the search field never changes width, but it is dimmed and opens no sheet: a tap goes to Posts with the same query,
 * through the page's pending navigation, so the Posts tab lights up at once like any tab tap.
 */
function FiltersToPosts({ href }: { href: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-label="Filters, for Posts only. Go to Posts"
      onClick={() => navigate(href, { id: "posts", replace: true })}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full opacity-50 transition-opacity duration-150 ease-out active:opacity-30 motion-reduce:transition-none"
    >
      <SlidersIcon size="h-6 w-6" />
    </button>
  );
}

/**
 * The Search page's pinned top: [back] [search field] [filters], then the Posts | People | Schools strip.
 * Back is a plain link to the feed, so it never steps through earlier searches or tabs (they replace each other in
 * the history). Without `nav` (while the page loads) the field and the Filters button are usable all the same (the
 * sheet is owned by `HeaderSheets`) and the tabs are inert labels, the one for `tab` highlighted. The Filters button is
 * always there: fully active on Posts, dimmed on People and Schools. The top row and the tab strip are separate
 * elements. `enter` fades the page in on arrival.
 */
export function SearchHeader({ nav, q = "", tab = "posts", enter = false }: { nav?: SearchNav; q?: string; tab?: string; enter?: boolean }) {
  useProvideFilterOptions(nav?.filters?.options ?? null);
  // The Filters button follows the tab just tapped, like the highlight, so nothing waits for the page.
  const shownTab = useShownTab(tab);
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
          {shownTab === "posts" ? <FiltersButton activeCount={nav?.filters?.activeCount} /> : <FiltersToPosts href={nav?.tabs.find((t) => t.id === "posts")?.href ?? postsHref(q)} />}
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
            : TAB_LABELS.map((t) => (
                <span key={t.id} aria-current={t.id === tab ? "page" : undefined} className={t.id === tab ? tabOn : `${tabOff} opacity-60`}>
                  {t.label}
                </span>
              ))}
        </nav>
      </div>
    </header>
  );
}

const REAL_TABS: readonly string[] = TAB_LABELS.map((t) => t.id);

/**
 * What the Search page shows before its data is ready: the header (tab highlighted, Filters button in place) and the
 * skeleton that matches the address (`kind`, from the whole query string: filters count too). A People link never
 * starts as cards. With no props it is the plain Posts page, which is what the prerendered shell shows.
 */
export function SearchLoading({ tab = "posts", q = "", kind = "categories", enter = false }: { tab?: string; q?: string; kind?: ResultsKind; enter?: boolean }) {
  return (
    <>
      <SearchHeader tab={tab} q={q} enter={enter} />
      <main className={`mx-auto w-full max-w-3xl flex-1 px-3 py-3 ${enter ? "transition-opacity duration-150 ease-out starting:opacity-0 motion-reduce:transition-none" : ""}`}>
        {resultsSkeletons[kind]}
      </main>
    </>
  );
}

/** `SearchLoading` for the address of the page being opened. Needs its own Suspense (the address is not known to the prerendered shell). */
export function SearchLoadingFromUrl() {
  const params = useSearchParams();
  const tab = params.get("tab") ?? "";
  // Words typed are trimmed and spaces collapsed, as the page itself reads them.
  const q = (params.get("q") ?? "").replace(/\s+/g, " ").trim();
  return <SearchLoading tab={REAL_TABS.includes(tab) ? tab : "posts"} q={q} kind={resultsKindFor(`/search?${params}`)} />;
}
