import type { ReactNode } from "react";
import type { ResultsKind } from "@/lib/discovery/results-kind";

const block = "rounded bg-zinc-200 dark:bg-zinc-800";

/** Two rows of grey cards where the grid will be, so the page does not jump when the posts arrive. */
export function CardGridSkeleton() {
  return (
    <ul aria-hidden className="grid grid-cols-2 gap-3 motion-safe:animate-pulse sm:grid-cols-3">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-xl border border-zinc-200/80 dark:border-zinc-800">
          <div className="aspect-square w-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex flex-col gap-1.5 px-3 pb-3 pt-3">
            <div className="flex h-11 items-center gap-2">
              <div className={`h-5 w-5 rounded-full ${block}`} />
              <div className={`h-5 w-1/2 ${block}`} />
            </div>
            <div className={`h-4 w-5/6 ${block}`} />
            <div className={`h-3 w-2/3 ${block}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Grey rows where the People or Schools list will be, with the same row height, so the page does not jump when they arrive. */
export function ListSkeleton({ kind }: { kind: "people" | "schools" }) {
  return (
    <ul aria-hidden className="flex flex-col divide-y divide-zinc-200 motion-safe:animate-pulse dark:divide-zinc-800">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="flex min-h-14 items-center gap-3 py-2">
          {kind === "people" ? <div className="h-12 w-12 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" /> : null}
          <div className={`flex min-w-0 flex-1 flex-col justify-around ${kind === "people" ? "h-16" : "h-11"}`}>
            <div className={`h-4 w-1/2 ${block}`} />
            <div className={`h-3 w-1/3 ${block}`} />
            {kind === "people" ? <div className={`h-3 w-2/5 ${block}`} /> : null}
          </div>
          {kind === "schools" ? <div className={`h-3 w-16 shrink-0 ${block}`} /> : null}
        </li>
      ))}
    </ul>
  );
}

/** Grey rows where an option list will be: with a round icon (the category lists) or a check box at the right (the filter lists), at the real rows' height. */
export function RowsSkeleton({ variant, count = 6 }: { variant: "icon" | "check"; count?: number }) {
  return (
    <ul aria-hidden className="motion-safe:animate-pulse">
      {Array.from({ length: count }, (_, i) =>
        variant === "icon" ? (
          <li key={i} className="flex h-14 items-center gap-3 px-2">
            <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className={`h-4 ${i % 3 === 0 ? "w-2/5" : i % 3 === 1 ? "w-1/2" : "w-1/3"} ${block}`} />
          </li>
        ) : (
          <li key={i} className="flex min-h-14 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
            <div className={`h-4 ${i % 3 === 0 ? "w-2/5" : i % 3 === 1 ? "w-1/2" : "w-1/3"} ${block}`} />
            <div className={`h-5 w-5 shrink-0 ${block}`} />
          </li>
        ),
      )}
    </ul>
  );
}

/** The Search page's category list while it loads: its title, then the rows. */
export function CategoryListSkeleton() {
  return (
    <div aria-hidden>
      <div className="px-2 pb-1">
        <div className={`h-7 w-28 ${block} motion-safe:animate-pulse`} />
      </div>
      <RowsSkeleton variant="icon" count={8} />
    </div>
  );
}

/** Where the one-line hint of People and Schools (with nothing typed) will be: two calm bars, no text. */
export function HintSkeleton() {
  return (
    <div aria-hidden className="flex flex-col items-center gap-3 px-6 py-12 motion-safe:animate-pulse">
      <div className={`h-4 w-3/5 ${block}`} />
      <div className={`h-4 w-2/5 ${block}`} />
    </div>
  );
}

/** The skeleton of each kind of Search results, so every target of a tab tap has a matching one. */
export const resultsSkeletons: Record<ResultsKind, ReactNode> = {
  grid: <CardGridSkeleton />,
  categories: <CategoryListSkeleton />,
  people: <ListSkeleton kind="people" />,
  schools: <ListSkeleton kind="schools" />,
  hint: <HintSkeleton />,
};

/** A photo, a price, a title and a seller row where a post will be. */
export function PostSkeleton() {
  return (
    <div aria-hidden className="mx-auto w-full max-w-md motion-safe:animate-pulse">
      <div className="aspect-square w-full bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className={`h-7 w-1/3 ${block}`} />
        <div className={`h-6 w-3/4 ${block}`} />
        <div className={`h-14 w-full ${block}`} />
      </div>
    </div>
  );
}
