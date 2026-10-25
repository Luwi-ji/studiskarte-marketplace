"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordInput } from "@/components/password-input";
import { buttonClass, inlineLinkClass, inputClass, outlineButtonClass } from "../auth-styles";
import { continueWithGoogle, signIn, type SignInState } from "./actions";

export function SignInForm({ google, googleFailed, next }: { google: boolean; googleFailed: boolean; next: string | null }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-5">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Email or handle</span>
          <input
            name="identifier"
            defaultValue={state.identifier}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            autoFocus
            placeholder="you@school.edu.ph or @handle"
            className={`${inputClass} placeholder:text-zinc-500`}
          />
        </label>
        <div className="flex flex-col gap-2">
          <label htmlFor="sign-in-password" className="text-sm font-semibold">
            Password
          </label>
          <PasswordInput id="sign-in-password" name="password" autoComplete="current-password" required />
          <Link href="/forgot-password" className="inline-flex min-h-11 items-center self-end text-sm font-medium text-brand-text">
            Forgot password?
          </Link>
        </div>
        {state.error ? (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>

      {google ? (
        <form action={continueWithGoogle} className="flex flex-col gap-4">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-zinc-500" aria-hidden>
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            or
            <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>
          {googleFailed ? (
            <p role="alert" className="text-sm text-red-600">
              Google sign-in did not finish. Try again, or use your email.
            </p>
          ) : null}
          <button type="submit" className={outlineButtonClass}>
            Continue with Google
          </button>
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
