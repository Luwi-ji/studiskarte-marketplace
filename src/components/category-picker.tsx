"use client";

import Link from "next/link";
import { useState } from "react";
import { CategoryIcon } from "@/components/category-icon";

type Option = { id: string; name: string };

/**
 * What an empty search shows: every category as a row, to tick one or several. The ticks live here until "Show" is
 * tapped, which opens the Posts results for them (replacing this page in the history, so Back still leaves Search).
 * "Show" floats above the tab bar and only exists while something is ticked.
 */
export function CategoryPicker({ categories }: { categories: Option[] }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  function toggle(id: string) {
    // Put the keyboard away so the whole list and the Show button are in view.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  // In the list's order, in the comma form the filters read (`category=a,b`).
  const chosen = categories.filter((c) => selected.has(c.id)).map((c) => c.id);
  const showHref = `/search?${new URLSearchParams({ tab: "posts", category: chosen.join(",") })}`;

  return (
    <section aria-labelledby="category-picker-title" className={chosen.length > 0 ? "pb-20" : undefined}>
      <h2 id="category-picker-title" className="px-2 pb-1 text-lg font-semibold">
        Categories
      </h2>
      <ul>
        {categories.map((c) => {
          const on = selected.has(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(c.id)}
                className={`flex h-14 w-full items-center gap-3 rounded-lg px-2 text-left text-base active:opacity-80 ${on ? "bg-brand/8 font-semibold text-brand-text" : "text-zinc-900 active:bg-zinc-100 dark:text-zinc-50 dark:active:bg-zinc-800"}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${on ? "bg-brand/15" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                  <CategoryIcon id={c.id} />
                </span>
                <span className="min-w-0 flex-1">{c.name}</span>
                {on ? (
                  <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      {chosen.length > 0 ? (
        <Link
          href={showHref}
          replace
          className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] z-40 mx-auto flex h-12 max-w-3xl items-center justify-center rounded-xl bg-brand text-base font-semibold text-white shadow-lg transition-transform duration-150 ease-out active:opacity-90 motion-reduce:transition-none starting:translate-y-[calc(100%+6rem)]"
        >
          {`Show (${chosen.length})`}
        </Link>
      ) : null}
    </section>
  );
}
