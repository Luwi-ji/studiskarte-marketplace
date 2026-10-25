"use client";

import { useId, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { checkLocation, LOCATION_MAX } from "@/lib/identity/location";
import { EDIT_PROFILE, useDraft, useLeave } from "../draft";

/** The Location page: one line. Done keeps it in the Edit profile draft; nothing is saved until Save there. */
export function LocationField() {
  const draft = useDraft();
  const leave = useLeave(EDIT_PROFILE);
  const id = useId();
  const [value, setValue] = useState(draft.location);
  const [error, setError] = useState<string | null>(null);
  const changed = value !== draft.location;
  const left = LOCATION_MAX - [...value].length;

  function done(event?: { preventDefault: () => void }) {
    event?.preventDefault();
    if (!changed) return;
    const checked = checkLocation(value);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    draft.setLocation(checked.location ?? "");
    leave();
  }

  return (
    <>
      <PageHeader
        title="Location"
        back={EDIT_PROFILE}
        action={
          <button type="submit" form="location-form" disabled={!changed} className="press flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-base font-semibold text-brand-text disabled:text-zinc-400 disabled:dark:text-zinc-600">
            Done
          </button>
        }
      />
      <main className="mx-auto w-full max-w-md flex-1">
        <form id="location-form" onSubmit={done} className="flex flex-col gap-2 px-4 pt-4">
          <label htmlFor={id} className="text-sm text-zinc-600 dark:text-zinc-400">
            Where are you based?
          </label>
          <div className="relative">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 fill-none stroke-zinc-500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
              <circle cx="12" cy="9.5" r="2.5" />
            </svg>
            <input
              id={id}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              autoFocus
              enterKeyHint="done"
              autoComplete="address-level2"
              placeholder="e.g. Sampaloc, Manila"
              aria-invalid={error ? true : undefined}
              aria-describedby={`${id}-note`}
              className={`min-h-12 w-full rounded-lg border bg-transparent py-2 pl-11 pr-3 text-base outline-none focus:border-brand ${error ? "border-red-600" : "border-zinc-300 dark:border-zinc-700"}`}
            />
          </div>
          <div id={`${id}-note`} className="flex items-start justify-between gap-3 text-sm">
            {error ? (
              <p role="alert" className="text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : (
              <p className="text-zinc-600 dark:text-zinc-400">Optional. A barangay, city or area, not your exact address. It shows on your profile.</p>
            )}
            <span className={`shrink-0 tabular-nums ${left < 0 ? "text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"}`}>{left}</span>
          </div>
          {draft.location !== "" || value !== "" ? (
            <button
              type="button"
              onClick={() => {
                setValue("");
                setError(null);
              }}
              disabled={value === ""}
              className="press mt-2 min-h-11 self-start rounded-lg px-1 text-base font-medium text-red-600 disabled:opacity-40 dark:text-red-400"
            >
              Remove location
            </button>
          ) : null}
        </form>
      </main>
    </>
  );
}
