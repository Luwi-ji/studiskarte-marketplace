"use client";

import { failOnServer } from "./actions";

export function TestButtons() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Sentry test</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Each button raises one test error. Check Sentry Issues a minute later.</p>
      <button
        type="button"
        className="h-12 rounded-lg bg-brand font-medium text-white"
        onClick={() => {
          setTimeout(() => {
            throw new Error(`Sentry browser test ${new Date().toISOString()}`);
          }, 0);
        }}
      >
        Raise a browser error
      </button>
      <form action={failOnServer}>
        <button type="submit" className="h-12 w-full rounded-lg border border-zinc-300 font-medium dark:border-zinc-700">
          Raise a server error (this page will show an error)
        </button>
      </form>
    </div>
  );
}
