"use client";

import { useState, type ReactNode } from "react";
import { CategoryIcon } from "@/components/category-icon";
import { OptionsPending, type Option } from "@/components/filter-options";
import { PendingLink } from "@/components/pending-nav";

/**
 * The multi-select category list and its Clear / Show bar, shared by the Search page's category list and the feed's
 * drawer so the two cannot drift: the same rows (icon, name, check, tinted when chosen) and the same bar.
 */

/** The chosen category ids, in the list's order once the list is known. Clear empties them. */
export function useCategorySelection(categories: Option[] | null, initial: readonly string[] = []) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(initial));
  const chosen = categories ? categories.filter((c) => selected.has(c.id)).map((c) => c.id) : [...selected];

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return { selected, chosen, toggle, clear: () => setSelected(new Set()) };
}

/** A row's look; `on` tints it with the brand colour. */
export function categoryRowClass(on: boolean) {
  return `flex h-14 w-full items-center gap-3 rounded-lg px-2 text-left text-base transition-[background-color,scale] duration-100 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 ${on ? "bg-brand/8 font-semibold text-brand-text active:bg-brand/20" : "text-zinc-900 active:bg-zinc-200 dark:text-zinc-50 dark:active:bg-zinc-700"}`;
}

/** The inside of a row: icon in a round chip, the name, and a check when chosen. */
export function CategoryRowContent({ icon, on, children }: { icon: ReactNode; on: boolean; children: ReactNode }) {
  return (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${on ? "bg-brand/15" : "bg-zinc-100 dark:bg-zinc-800"}`}>{icon}</span>
      <span className="line-clamp-2 min-w-0 flex-1 leading-snug">{children}</span>
      {on ? (
        <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      ) : null}
    </>
  );
}

/**
 * Every category as a toggle row. `leading` rows (the drawer's "All categories") come first. Until the categories are
 * here (`categories` null) the list shows skeleton rows, and becomes interactive when they arrive.
 */
export function CategoryList({
  categories,
  failed = false,
  selected,
  onToggle,
  leading,
}: {
  categories: Option[] | null;
  failed?: boolean;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  leading?: ReactNode;
}) {
  if (!categories) {
    return (
      <>
        {leading ? <ul>{leading}</ul> : null}
        <OptionsPending failed={failed} variant="icon" />
      </>
    );
  }
  return (
    <ul>
      {leading}
      {categories.map((c) => {
        const on = selected.has(c.id);
        return (
          <li key={c.id}>
            <button type="button" aria-pressed={on} onClick={() => onToggle(c.id)} className={categoryRowClass(on)}>
              <CategoryRowContent icon={<CategoryIcon id={c.id} />} on={on}>
                {c.name}
              </CategoryRowContent>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The floating bar with the choice's two actions: a secondary "Clear" (a third of the width) and the primary
 * "Show (n)", both 48 px tall. It exists only while something is chosen; `className` places it.
 */
export function SelectionBar({
  count,
  href,
  replace,
  id,
  onClear,
  onShow,
  className,
}: {
  count: number;
  href: string;
  replace?: boolean;
  id?: string;
  onClear: () => void;
  onShow?: () => void;
  className: string;
}) {
  return (
    <div className={`grid grid-cols-3 gap-2 transition-transform duration-150 ease-out motion-reduce:transition-none starting:translate-y-[calc(100%+6rem)] ${className}`}>
      <button
        type="button"
        onClick={onClear}
        className="flex h-12 items-center justify-center rounded-xl border border-zinc-300 bg-[var(--background)] text-base font-semibold text-zinc-900 shadow-lg transition-[background-color,scale] duration-100 ease-out active:scale-[0.98] active:bg-zinc-200 motion-reduce:transition-none motion-reduce:active:scale-100 dark:border-zinc-700 dark:text-zinc-50 dark:active:bg-zinc-700"
      >
        Clear
      </button>
      <PendingLink
        href={href}
        replace={replace}
        id={id}
        prefetch={false}
        onClick={onShow}
        className="col-span-2 flex h-12 items-center justify-center rounded-xl bg-brand text-base font-semibold text-white shadow-lg transition-[background-color,scale] duration-100 ease-out active:scale-[0.98] active:bg-brand-strong motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        {`Show (${count})`}
      </PendingLink>
    </div>
  );
}
