"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Turnstile } from "@/components/turnstile";
import { PASSWORD_MIN } from "@/lib/identity/password-rules";
import { buttonClass, inlineLinkClass, inputClass, linkClass } from "../auth-styles";
import { requestReset, resetPassword, type ResetState } from "./actions";

export function ResetForm() {
  const [requested, requestAction, requesting] = useActionState<ResetState, FormData>(requestReset, { step: "who" });
  const [reset, resetAction, resetting] = useActionState<ResetState, FormData>(resetPassword, { step: "who" });

  if (requested.step === "code") {
    const error = reset.step === "code" && reset.identifier === requested.identifier ? reset.error : undefined;
    return (
      <form action={resetAction} className="flex flex-col gap-4">
        <p className="text-zinc-600 dark:text-zinc-400">
          If there is an account for <strong>{requested.identifier}</strong>, we sent a 6-digit code to its sign-in email.
          It works for 5 minutes.
        </p>
        <input type="hidden" name="identifier" value={requested.identifier} />
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Code</span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            required
            autoFocus
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">New password</span>
          <input name="password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} required className={inputClass} />
        </label>
        <Turnstile action="password_reset" resetKey={requesting ? 1 : 0} />
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <button type="submit" disabled={resetting || requesting} className={buttonClass}>
          {resetting ? "Saving…" : "Set password and log in"}
        </button>
        {/* Submits the same form (with the hidden identifier) to the request action. */}
        <button type="submit" formAction={requestAction} formNoValidate disabled={resetting || requesting} className={linkClass}>
          {requesting ? "Sending…" : "Send a new code"}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={requestAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">School email, email or handle</span>
          <input
            name="identifier"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            autoFocus
            className={inputClass}
          />
        </label>
        <Turnstile action="password_reset" resetKey={requesting ? 1 : 0} />
        {requested.error ? <p role="alert" className="text-sm text-red-600">{requested.error}</p> : null}
        <button type="submit" disabled={requesting} className={buttonClass}>
          {requesting ? "Sending…" : "Send code"}
        </button>
      </form>
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/sign-in" className={inlineLinkClass}>
          Back to log in
        </Link>
      </p>
    </div>
  );
}
