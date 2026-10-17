"use client";

/** Shown when a request did not get an answer at all, often because the app was updated while this page stayed open. */
export const NO_ANSWER = "Could not reach the app. If it was just updated, reload the page and try again.";

export function ReloadButton() {
  return (
    <button type="button" onClick={() => window.location.reload()} className="h-11 rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700">
      Reload the page
    </button>
  );
}
