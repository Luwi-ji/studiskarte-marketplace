"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buttonClass, inlineLinkClass, inputClass, linkClass, outlineButtonClass } from "../auth-styles";
import { continueWithGoogle, signIn, type SignInState } from "./actions";

export function SignInForm({ google, googleFailed, next }: { google: boolean; googleFailed: boolean; next: string | null }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">School email, email or handle</span>
          <input
            name="identifier"
            defaultValue={state.identifier}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            autoFocus
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Password</span>
          <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
        </label>
        {state.error ? <p role="alert" className="text-sm text-red-600">{state.error}</p> : null}
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Signing in…" : "Log in"}
        </button>
        <Link href="/forgot-password" className={`${linkClass} self-center`}>
          Forgot password?
        </Link>
      </form>
      {google ? (
        <form action={continueWithGoogle} className="flex flex-col gap-2">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {googleFailed ? (
            <p role="alert" className="text-sm text-red-600">Google sign-in did not finish. Try again, or use your email.</p>
          ) : null}
          <button type="submit" className={outlineButtonClass}>Continue with Google</button>
        </form>
      ) : null}
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        New here?{" "}
        <Link href={next ? `/sign-up?next=${encodeURIComponent(next)}` : "/sign-up"} className={inlineLinkClass}>
          Create an account
        </Link>
      </p>
    </div>
  );
}
