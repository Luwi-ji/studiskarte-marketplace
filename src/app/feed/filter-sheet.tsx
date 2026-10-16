"use client";

import { useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LISTED, LISTED_LABEL, SORT_LABEL, SORTS } from "@/lib/discovery/filters";
import { CONDITION_LABEL, CONDITIONS } from "@/lib/posts/schema";

type Option = { id: string; name: string };

type Props = {
  /** The page the filters apply to, e.g. "/" or "/search". */
  action: string;
  categories: Option[];
  schools: Option[];
  /** What is chosen now, as the page's query-string values. */
  values: Record<string, string>;
  /** Query-string values to keep when filters change (the search words and tab). */
  keep: Record<string, string>;
  activeCount: number;
};

const FILTER_KEYS = ["kind", "category", "condition", "min", "max", "school", "listed", "sort"];
const field =
  "h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const legend = "text-sm font-medium";

/** The Filters button and the bottom sheet it opens. Applying changes the page's query string. */
export function FilterSheet({ action, categories, schools, values, keep, activeCount }: Props) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);

  function go(params: URLSearchParams) {
    const qs = params.toString();
    router.push(qs ? `${action}?${qs}` : action);
    dialog.current?.close();
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams(keep);
    for (const key of FILTER_KEYS) {
      const value = data.get(key);
      if (typeof value === "string" && value !== "" && !(key === "sort" && value === "newest")) params.set(key, value);
    }
    go(params);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-zinc-300 px-3 font-medium dark:border-zinc-700"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 5v4M6 15v4" />
        </svg>
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>

      <dialog
        ref={dialog}
        aria-label="Filters and sort"
        className="m-0 mt-auto max-h-[90dvh] w-full max-w-none rounded-t-2xl bg-[var(--background)] p-0 text-[var(--foreground)] backdrop:bg-black/50"
      >
        {/* Keyed on the page's filters: when they change (apply, clear, a link) the fields start from them again. */}
        <form key={JSON.stringify(values)} onSubmit={apply} className="mx-auto flex max-h-[90dvh] w-full max-w-md flex-col">
          <div className="flex items-center justify-between px-4 pt-2">
            <h2 className="text-lg font-semibold">Filters and sort</h2>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl">
              ×
            </button>
          </div>

          <div className="flex flex-col gap-5 overflow-y-auto px-4 py-3">
            <fieldset className="flex flex-col gap-1">
              <legend className={legend}>Sort by</legend>
              {SORTS.map((sort) => (
                <label key={sort} className="flex min-h-11 items-center gap-3">
                  <input className="h-5 w-5 shrink-0" type="radio" name="sort" value={sort} defaultChecked={(values.sort ?? "newest") === sort} />
                  {SORT_LABEL[sort]}
                </label>
              ))}
            </fieldset>

            <fieldset className="flex flex-col gap-1">
              <legend className={legend}>Type</legend>
              {[
                ["", "Showcase and Wishlist"],
                ["showcase", "Showcase (for sale or giveaway)"],
                ["wishlist", "Wishlist (looking for)"],
              ].map(([value, text]) => (
                <label key={value} className="flex min-h-11 items-center gap-3">
                  <input className="h-5 w-5 shrink-0" type="radio" name="kind" value={value} defaultChecked={(values.kind ?? "") === value} />
                  {text}
                </label>
              ))}
            </fieldset>

            <label className="flex flex-col gap-1">
              <span className={legend}>Category</span>
              <select name="category" defaultValue={values.category ?? ""} className={field}>
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className={legend}>Condition</span>
              <select name="condition" defaultValue={values.condition ?? ""} className={field}>
                <option value="">Any condition</option>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {CONDITION_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="flex flex-col gap-1">
              <legend className={legend}>Price (₱)</legend>
              <div className="flex items-center gap-2">
                <input name="min" type="number" inputMode="numeric" min={0} step={1} placeholder="From" aria-label="Lowest price" defaultValue={values.min ?? ""} className={field} />
                <span aria-hidden>–</span>
                <input name="max" type="number" inputMode="numeric" min={0} step={1} placeholder="To" aria-label="Highest price" defaultValue={values.max ?? ""} className={field} />
              </div>
              <p className="text-xs text-zinc-500">Free posts count as ₱0. Posts with a negotiable price do not match a price range.</p>
            </fieldset>

            <label className="flex flex-col gap-1">
              <span className={legend}>School</span>
              <select name="school" defaultValue={values.school ?? ""} className={field}>
                <option value="">All schools</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className={legend}>Listed</span>
              <select name="listed" defaultValue={values.listed ?? ""} className={field}>
                <option value="">Any time</option>
                {LISTED.map((l) => (
                  <option key={l} value={l}>
                    {LISTED_LABEL[l]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-zinc-200 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 dark:border-zinc-800">
            <button type="button" onClick={() => go(new URLSearchParams(keep))} className="h-12 rounded-lg border border-zinc-300 font-medium dark:border-zinc-700">
              Clear all
            </button>
            <button type="submit" className="h-12 rounded-lg bg-brand font-medium text-white">
              Show results
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
