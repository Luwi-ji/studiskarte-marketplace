"use client";

import { useActionState, useState } from "react";
import { PASSWORD_MIN } from "@/lib/identity/password-rules";
import { choosePassword, type PasswordState } from "./actions";

const input =
  "w-full rounded-lg border border-zinc-300 bg-white py-3 pl-3 pr-14 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

/**
 * One field with a show button instead of "type it again": fewer fields, and the person sees what they typed. The second
 * value the server checks is the same text, sent in a hidden field.
 */
export function PasswordForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(choosePassword, {});
  const [password, setPassword] = useState("");
  const [shown, setShown] = useState(false);
  const long = password.length >= PASSWORD_MIN;

  return (
    <form action={action} className="flex flex-col gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <input type="hidden" name="confirm" value={password} />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Password</span>
        <div className="relative">
          <input
            name="password"
            type={shown ? "text" : "password"}
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            required
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={input}
          />
          <button
            type="button"
            onClick={() => setShown((was) => !was)}
            aria-pressed={shown}
            className="press absolute right-1 top-1/2 flex h-11 min-w-12 -translate-y-1/2 items-center justify-center rounded-lg px-2 text-sm font-semibold text-brand-text"
          >
            {shown ? "Hide" : "Show"}
          </button>
        </div>
        <span className={`flex items-center gap-2 text-sm ${long ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-600 dark:text-zinc-400"}`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-none stroke-current" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {long ? <path d="M5 12.5l4.2 4.2L19 7" /> : <circle cx="12" cy="12" r="8" />}
          </svg>
          At least {PASSWORD_MIN} characters
        </span>
      </label>
      {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
      <button type="submit" disabled={pending || !long} className="w-full rounded-lg bg-brand px-3 py-3 text-base font-medium text-white disabled:opacity-60">
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
