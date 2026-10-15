"use client";

import { useActionState } from "react";
import { requestCode, verifyCode, type SignInState } from "./actions";

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const button =
  "w-full rounded-lg bg-zinc-900 px-3 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900";

export function SignInForm() {
  const [requested, requestAction, requesting] = useActionState<SignInState, FormData>(
    requestCode,
    { step: "email" },
  );
  const [verified, verifyAction, verifying] = useActionState<SignInState, FormData>(
    verifyCode,
    { step: "email" },
  );

  // The code step belongs to the address just requested; its errors come from verifyAction.
  if (requested.step === "code") {
    const error = verified.step === "code" && verified.email === requested.email ? verified.error : undefined;
    return (
      <form action={verifyAction} className="flex flex-col gap-4">
        <p className="text-zinc-600 dark:text-zinc-400">
          We sent a 6-digit code to <strong>{requested.email}</strong>. It works for 5 minutes.
          Use the newest email: asking for a new code cancels the old one.
        </p>
        <input type="hidden" name="email" value={requested.email} />
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
            className={input}
          />
        </label>
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <button type="submit" disabled={verifying || requesting} className={button}>
          {verifying ? "Checking…" : "Sign in"}
        </button>
        {/* Submits the same form (with the hidden email) to the request action. */}
        <button
          type="submit"
          formAction={requestAction}
          formNoValidate
          disabled={verifying || requesting}
          className="text-sm text-zinc-600 underline disabled:opacity-60 dark:text-zinc-400"
        >
          {requesting ? "Sending…" : "Send a new code"}
        </button>
      </form>
    );
  }

  return (
    <form action={requestAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">School email</span>
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@school.edu.ph"
          required
          autoFocus
          className={input}
        />
      </label>
      {requested.error ? <p role="alert" className="text-sm text-red-600">{requested.error}</p> : null}
      <button type="submit" disabled={requesting} className={button}>
        {requesting ? "Sending…" : "Send code"}
      </button>
    </form>
  );
}
