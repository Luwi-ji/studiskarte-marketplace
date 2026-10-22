"use client";

import { CategoryList, SelectionBar, useCategorySelection } from "@/components/category-select";
import type { Option } from "@/components/filter-options";

/**
 * What an empty search shows: every category as a row, to tick one or several. The ticks live here until "Show" is
 * tapped, which opens the Posts results for them (replacing this page in the history, so Back still leaves Search).
 * The Clear / Show bar floats above the tab bar and only exists while something is ticked.
 */
export function CategoryPicker({ categories }: { categories: Option[] }) {
  const { selected, chosen, toggle, clear } = useCategorySelection(categories);

  // In the list's order, in the comma form the filters read (`category=a,b`).
  const showHref = `/search?${new URLSearchParams({ tab: "posts", category: chosen.join(",") })}`;

  return (
    <section aria-labelledby="category-picker-title" className={chosen.length > 0 ? "pb-20" : undefined}>
      <h2 id="category-picker-title" className="px-2 pb-1 text-lg font-semibold">
        Categories
      </h2>
      <CategoryList
        categories={categories}
        selected={selected}
        onToggle={(id) => {
          // Put the keyboard away so the whole list and the bar are in view.
          if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
          toggle(id);
        }}
      />

      {chosen.length > 0 ? (
        <SelectionBar
          count={chosen.length}
          href={showHref}
          replace
          id="posts"
          onClear={clear}
          className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] z-40 mx-auto max-w-3xl will-change-transform motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out [html[data-tab-bar-hidden]_&]:translate-y-16"
        />
      ) : null}
    </section>
  );
}
