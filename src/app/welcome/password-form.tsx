"use client";

import { useActionState } from "react";
import { PASSWORD_MIN } from "@/lib/identity/password-rules";
import { choosePassword, type PasswordState } from "./actions";

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export function PasswordForm({ next }: { next: string | null }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(choosePassword, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Password</span>
        <input name="password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} required autoFocus className={input} />
        <span className="text-xs text-zinc-500">At least {PASSWORD_MIN} characters. You log in with it from now on.</span>
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Type it again</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} required className={input} />
      </label>
      {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand px-3 py-3 text-base font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
