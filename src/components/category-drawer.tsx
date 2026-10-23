"use client";

import { useRef, useState } from "react";
import { AllCategoriesIcon } from "@/components/category-icon";
import { CategoryList, categoryRowClass, CategoryRowContent, SelectionBar, useCategorySelection } from "@/components/category-select";
import type { Option, Session } from "@/components/filter-options";
import { PendingLink, useNavigate } from "@/components/pending-nav";
import { useSlideDialog } from "@/components/use-slide-dialog";

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
 * several, the same list and Clear / Show bar as the Search page), and Show applies them to the feed; Clear also
 * lifts any categories the feed already shows, at once. A native modal dialog, so it traps focus and closes on
 * Escape; it also closes on a tap of the dimmed page, a swipe left, the close control, "All categories" or Show. The
 * close control sits where the hamburger is and is the hamburger turned into an X as the drawer slides in. The button
 * that opens it lives in the header, which may be swapped while the page loads.
 */
export function CategoryDrawer({ open, onOpenChange, session, categories, failed, returnFocusTo }: Props) {
  const drawer = useRef<HTMLDialogElement>(null);
  const dialogProps = useSlideDialog(drawer, { open, onOpenChange, edge: "left", ms: 180, closeShare: 0.3, returnFocusTo });

  const close = () => onOpenChange(false);

  return (
    <dialog
      ref={drawer}
      aria-label="Browse by categories"
      {...dialogProps}
      className="group/drawer fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none touch-pan-y bg-[var(--background)] p-0 text-[var(--foreground)] shadow-xl outline-none backdrop:bg-black/50 backdrop:opacity-0 backdrop:transition-opacity backdrop:duration-150 data-[shown=true]:backdrop:opacity-100 motion-reduce:backdrop:transition-none"
    >
      <div className="flex h-full flex-col pt-[env(safe-area-inset-top)]">
        {/* Same box as the hamburger in the header (8 px in, 4 px down), so the X replaces it in place. */}
        <div className="flex items-center gap-1 px-2 pt-1">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-100 active:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-brand-text dark:active:bg-zinc-800"
          >
            <span aria-hidden className={`${bar} -translate-y-1.5 group-data-[shown=true]/drawer:translate-y-0 group-data-[shown=true]/drawer:rotate-45 group-data-[shown=true]/drawer:delay-[50ms]`} />
            <span aria-hidden className={`${bar} group-data-[shown=true]/drawer:opacity-0 group-data-[shown=true]/drawer:delay-[50ms]`} />
            <span aria-hidden className={`${bar} translate-y-1.5 group-data-[shown=true]/drawer:translate-y-0 group-data-[shown=true]/drawer:-rotate-45 group-data-[shown=true]/drawer:delay-[50ms]`} />
          </button>
          <h2 className="min-w-0 truncate text-lg font-semibold">Browse by categories</h2>
        </div>
        {session ? <DrawerBody key={session.n} values={session.values} categories={categories} failed={failed} close={close} /> : null}
      </div>
    </dialog>
  );
}

// One bar of the hamburger: three of them at rest, an X once the drawer is shown (180 ms; on the way in it starts 50 ms late, when the sliding drawer has brought the button into view; none with reduced motion).
const bar = "absolute left-[13px] top-[21px] h-0.5 w-[18px] rounded-full bg-current transition-[translate,rotate,opacity] duration-[180ms] ease-out motion-reduce:transition-none";

function DrawerBody({ values, categories, failed, close }: { values: Record<string, string>; categories: Option[] | null; failed: boolean; close: () => void }) {
  const navigate = useNavigate();
  // The categories the feed shows now start ticked.
  const { selected, chosen, toggle, clear } = useCategorySelection(
    categories,
    (values.category ?? "").split(",").filter(Boolean),
  );
  const none = chosen.length === 0;
  // Whether the address still carries categories: Clear must lift them from the feed, not only from the ticks.
  const [applied, setApplied] = useState((values.category ?? "") !== "");

  function onClear() {
    // The Clear button is about to leave: keep focus inside the drawer, on the drawer itself (no ring).
    if (document.activeElement instanceof HTMLElement) document.activeElement.closest("dialog")?.focus({ preventScroll: true });
    clear();
    if (!applied) return;
    setApplied(false);
    navigate(feedHref(values, []));
  }

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
          onClear={onClear}
          onShow={close}
          className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-10"
        />
      )}
    </div>
  );
}
