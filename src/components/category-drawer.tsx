"use client";

import { useEffect, useRef } from "react";
import { AllCategoriesIcon } from "@/components/category-icon";
import { CategoryList, categoryRowClass, CategoryRowContent, SelectionBar, useCategorySelection } from "@/components/category-select";
import type { Option, Session } from "@/components/filter-options";
import { PendingLink } from "@/components/pending-nav";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present once the drawer has been opened; each opening starts from the page's current query-string values. */
  session: Session | null;
  /** Null until they have arrived: the list shows skeleton rows meanwhile. */
  categories: Option[] | null;
  failed: boolean;
  /** CSS selector of the button that opens the drawer, to give focus back to if that button was replaced meanwhile. */
  returnFocusTo: string;
};

/** The feed at `values` with the categories replaced by `ids` (none: removed); every other filter stays. */
function feedHref(values: Record<string, string>, ids: string[]) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (key !== "category") params.set(key, value);
  if (ids.length > 0) params.set("category", ids.join(","));
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

/**
 * The left slide-over the hamburger opens: "All categories", then every category as a toggle row (tick one or
 * several, the same list and Clear / Show bar as the Search page), and Show applies them to the feed. A native modal
 * dialog, so it traps focus and closes on Escape; it also closes on a tap of the dimmed page, the Close button, "All
 * categories" or Show. The button that opens it lives in the header, which may be swapped while the page loads.
 */
export function CategoryDrawer({ open, onOpenChange, session, categories, failed, returnFocusTo }: Props) {
  const drawer = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = drawer.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  const close = () => onOpenChange(false);

  return (
    <dialog
      ref={drawer}
      aria-label="Browse by categories"
      onClose={() => {
        onOpenChange(false);
        // The dialog gives focus back to the button that opened it, unless that button has been replaced since.
        if (!document.activeElement || document.activeElement === document.body) document.querySelector<HTMLElement>(returnFocusTo)?.focus();
      }}
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
        {session ? <DrawerBody key={session.n} values={session.values} categories={categories} failed={failed} close={close} /> : null}
      </div>
    </dialog>
  );
}

function DrawerBody({ values, categories, failed, close }: { values: Record<string, string>; categories: Option[] | null; failed: boolean; close: () => void }) {
  // The categories the feed shows now start ticked.
  const { selected, chosen, toggle, clear } = useCategorySelection(
    categories,
    (values.category ?? "").split(",").filter(Boolean),
  );
  const none = chosen.length === 0;

  return (
    <div className="relative mt-2 min-h-0 flex-1 border-t border-zinc-200 dark:border-zinc-800">
      <div className={`h-full overflow-y-auto overscroll-contain px-1 pt-1 ${none ? "pb-[env(safe-area-inset-bottom)]" : "pb-[calc(5rem+env(safe-area-inset-bottom))]"}`}>
        <CategoryList
          categories={categories}
          failed={failed}
          selected={selected}
          onToggle={toggle}
          leading={
            <li>
              <PendingLink
                href={feedHref(values, [])}
                prefetch={false}
                current={none}
                onClick={() => {
                  clear();
                  close();
                }}
                className={categoryRowClass(none)}
              >
                <CategoryRowContent icon={<AllCategoriesIcon />} on={none}>
                  All categories
                </CategoryRowContent>
              </PendingLink>
            </li>
          }
        />
      </div>
      {none ? null : (
        <SelectionBar
          count={chosen.length}
          href={feedHref(values, chosen)}
          onClear={clear}
          onShow={close}
          className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-10"
        />
      )}
    </div>
  );
}
