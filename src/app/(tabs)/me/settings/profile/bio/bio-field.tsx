"use client";

import { useId, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { BIO_MAX, checkBio } from "@/lib/identity/bio";
import { EDIT_PROFILE, useDraft, useLeave } from "../draft";

/** The Bio page: one text box. Done keeps the bio in the Edit profile draft; nothing is saved until Save there. */
export function BioField() {
  const draft = useDraft();
  const leave = useLeave(EDIT_PROFILE);
  const id = useId();
  const [value, setValue] = useState(draft.bio);
  const [error, setError] = useState<string | null>(null);
  const changed = value !== draft.bio;
  const left = BIO_MAX - [...value].length;

  function done(event?: { preventDefault: () => void }) {
    event?.preventDefault();
    if (!changed) return;
    const checked = checkBio(value);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    draft.setBio(checked.bio ?? "");
    leave();
  }

  return (
    <>
      <PageHeader
        title="Bio"
        back={EDIT_PROFILE}
        action={
          <button type="submit" form="bio-form" disabled={!changed} className="press flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-base font-semibold text-brand-text disabled:text-zinc-400 disabled:dark:text-zinc-600">
            Done
          </button>
        }
      />
      <main className="mx-auto w-full max-w-md flex-1">
        <form id="bio-form" onSubmit={done} className="flex flex-col gap-2 px-4 pt-4">
          <label htmlFor={id} className="text-sm text-zinc-600 dark:text-zinc-400">
            Bio
          </label>
          <textarea
            id={id}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            rows={4}
            autoFocus
            enterKeyHint="done"
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-note`}
            className={`w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-base outline-none focus:border-brand ${error ? "border-red-600" : "border-zinc-300 dark:border-zinc-700"}`}
          />
          <div id={`${id}-note`} className="flex items-start justify-between gap-3 text-sm">
            {error ? (
              <p role="alert" className="text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : (
              <p className="text-zinc-600 dark:text-zinc-400">A short line about you. It shows on your profile. Up to {BIO_MAX} characters; line breaks become spaces.</p>
            )}
            <span className={`shrink-0 tabular-nums ${left < 0 ? "text-red-600 dark:text-red-400" : "text-zinc-600 dark:text-zinc-400"}`}>{left}</span>
          </div>
        </form>
      </main>
    </>
  );
}
