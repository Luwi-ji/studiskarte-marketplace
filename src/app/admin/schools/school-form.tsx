"use client";

import { useState } from "react";
import { useAction } from "@/app/safety/use-action";
import { setSchoolShortNameAction } from "./actions";

/** One school's abbreviation: save it, or save it empty to clear it. */
export function SchoolForm({ domain, initial, placeholder, max }: { domain: string; initial: string; placeholder: string; max: number }) {
  const step = useAction();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const unchanged = value.trim() === initial;

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        void step.run(() => setSchoolShortNameAction(domain, value), () => setSaved(true));
      }}
    >
      <div className="flex gap-2">
        <input
          name="shortName"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setSaved(false);
          }}
          maxLength={max}
          placeholder={placeholder}
          aria-label={`Abbreviation for ${domain}`}
          autoComplete="off"
          className="h-11 w-36 min-w-0 rounded-lg border border-zinc-300 bg-transparent px-3 text-base dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={step.busy || unchanged}
          className="h-11 shrink-0 rounded-lg border border-zinc-300 px-4 text-sm font-medium disabled:opacity-50 dark:border-zinc-700"
        >
          {step.busy ? "Saving…" : value.trim() === "" && initial !== "" ? "Clear" : "Save"}
        </button>
      </div>
      {step.error ? (
        <p role="alert" className="text-sm text-red-600">
          {step.error}
        </p>
      ) : null}
      {saved && !step.error ? (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          Saved.
        </p>
      ) : null}
    </form>
  );
}
