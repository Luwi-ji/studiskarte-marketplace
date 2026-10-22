"use client";

import { useEffect, useSyncExternalStore } from "react";
import { loadFilterOptionsAction } from "@/app/feed/actions";
import { RowsSkeleton } from "@/components/skeletons";

export type Option = { id: string; name: string };
export type FilterOptions = { categories: Option[]; schools: Option[] };
/** One opening of the drawer or sheet: the page's query-string values at that moment (`n` tells openings apart). */
export type Session = { n: number; values: Record<string, string> };

type State = { options: FilterOptions | null; failed: boolean };

/**
 * The categories and schools the category drawer and the Filters sheet list. They normally arrive with the page's own
 * data (`useProvideFilterOptions`); a tap before that fetches them once (a server action, so it needs neither the page
 * nor a build-time database) and every later opening has them at once.
 */
const EMPTY: State = { options: null, failed: false };
let state: State = EMPTY;
let loading = false;
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Start fetching the options if the page has not brought them. Safe to call on every tap. */
export function loadFilterOptions() {
  if (state.options || loading) return;
  loading = true;
  if (state.failed) set(EMPTY);
  loadFilterOptionsAction()
    .then(
      (options) => {
        if (!state.options) set({ options, failed: false });
      },
      () => {
        if (!state.options) set({ options: null, failed: true });
      },
    )
    .finally(() => {
      loading = false;
    });
}

export function useFilterOptions(): State {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

/** The loaded page hands over the options it already has, so the first tap needs no fetch. */
export function useProvideFilterOptions(options: FilterOptions | null) {
  useEffect(() => {
    if (options && JSON.stringify(options) !== JSON.stringify(state.options)) set({ options, failed: false });
  }, [options]);
}

/** What an option list shows until the options are here: skeleton rows, or a way to try again if the fetch failed. */
export function OptionsPending({ failed, variant }: { failed: boolean; variant: "icon" | "check" }) {
  if (failed) {
    return (
      <div className="flex flex-col items-start gap-2 px-4 py-4">
        <p className="text-sm text-zinc-500">The list did not load.</p>
        <button type="button" onClick={loadFilterOptions} className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 font-medium active:opacity-80 dark:border-zinc-700">
          Try again
        </button>
      </div>
    );
  }
  return (
    <div role="status">
      <span className="sr-only">Loading</span>
      <RowsSkeleton variant={variant} />
    </div>
  );
}
