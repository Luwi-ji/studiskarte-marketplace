"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { FilterSheet, SlidersIcon } from "@/app/feed/filter-sheet";
import { CategoryDrawer } from "@/components/category-drawer";
import { loadFilterOptions, useFilterOptions, type Session } from "@/components/filter-options";
import { usePendingHref } from "@/components/pending-nav";

type Sheet = "categories" | "filters";

const SheetsContext = createContext<((sheet: Sheet) => void) | null>(null);

const iconButton = "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full active:opacity-80";

/** The page's query-string values as the page itself reads them: the first value of each, empty ones left out. While a navigation is in flight, those of where it is going. */
function readQuery(pendingHref: string | null): Record<string, string> {
  const search = pendingHref ? new URL(pendingHref, window.location.origin).search : window.location.search;
  const values: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(search)) if (value !== "" && !(key in values)) values[key] = value;
  return values;
}

/**
 * Owns the category drawer (feed only) and the Filters sheet of a page, around the page's Suspense, together with the
 * header buttons that open them (`CategoriesButton`, `FiltersButton`). The buttons are in the header, which is first
 * drawn as a loading placeholder and then replaced by the real one; the sheets live here, so a tap works in either, the
 * sheet opens at once, and it stays open when the real header takes over. What the sheets need that the page has not
 * brought yet (the categories and schools) is fetched on the tap and shown as skeleton rows until it arrives; the
 * current filters are read from the address.
 */
export function HeaderSheets({ action, children }: { action: "/" | "/search"; children: ReactNode }) {
  const [open, setOpen] = useState<Sheet | null>(null);
  const [last, setLast] = useState<(Session & { sheet: Sheet }) | null>(null);
  const { options, failed } = useFilterOptions();
  const pendingHref = usePendingHref();

  const openSheet = useCallback(
    (sheet: Sheet) => {
      loadFilterOptions();
      const values = readQuery(pendingHref);
      setLast((current) => ({ sheet, n: (current?.n ?? 0) + 1, values }));
      setOpen(sheet);
    },
    [pendingHref],
  );
  const close = useCallback(() => setOpen(null), []);

  return (
    <SheetsContext.Provider value={openSheet}>
      {children}
      {action === "/" ? (
        <CategoryDrawer
          open={open === "categories"}
          onOpenChange={(next) => !next && close()}
          session={last?.sheet === "categories" ? last : null}
          categories={options?.categories ?? null}
          failed={failed}
          returnFocusTo='[data-sheet-trigger="categories"]'
        />
      ) : null}
      <FilterSheet
        open={open === "filters"}
        onOpenChange={(next) => !next && close()}
        action={action}
        session={last?.sheet === "filters" ? last : null}
        categories={options?.categories ?? null}
        schools={options?.schools ?? null}
        failed={failed}
        returnFocusTo='[data-sheet-trigger="filters"]'
      />
    </SheetsContext.Provider>
  );
}

function useOpenSheet() {
  const openSheet = useContext(SheetsContext);
  if (!openSheet) throw new Error("This button belongs inside HeaderSheets.");
  return openSheet;
}

/** The hamburger. Never disabled: it opens the drawer at once, even while the page is still loading. */
export function CategoriesButton() {
  const openSheet = useOpenSheet();
  return (
    <button type="button" data-sheet-trigger="categories" aria-label="Categories" aria-haspopup="dialog" onClick={() => openSheet("categories")} className={iconButton}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}

/** The Filters button, with the count of active filters once the page knows it. Never disabled. */
export function FiltersButton({ activeCount = 0 }: { activeCount?: number }) {
  const openSheet = useOpenSheet();
  return (
    <button
      type="button"
      data-sheet-trigger="filters"
      onClick={() => openSheet("filters")}
      aria-haspopup="dialog"
      aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"}
      className={iconButton}
    >
      <SlidersIcon size="h-6 w-6" />
      {activeCount > 0 ? (
        <span aria-hidden className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
          {activeCount > 9 ? "9+" : activeCount}
        </span>
      ) : null}
    </button>
  );
}
