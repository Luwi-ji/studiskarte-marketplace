"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buttonClass, inlineLinkClass, inputClass, linkClass } from "../auth-styles";
import { requestCode, verifyCode, type Mode, type SignUpState } from "./actions";

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: "school", label: "School email", hint: "For students, faculty, staff and alumni" },
  { value: "visitor", label: "Visitor", hint: "Any other email" },
];

/** `visitors` is false while sign-up without a school email is closed (ALLOW_VISITORS). */
export function SignUpForm({ visitors }: { visitors: boolean }) {
  const [requested, requestAction, requesting] = useActionState<SignUpState, FormData>(requestCode, {
    step: "email",
    mode: "school",
  });
  const [verified, verifyAction, verifying] = useActionState<SignUpState, FormData>(verifyCode, {
    step: "email",
    mode: "school",
  });

  // The code step belongs to the address just requested; its errors come from verifyAction.
  if (requested.step === "code") {
    const error = verified.step === "code" && verified.email === requested.email ? verified.error : undefined;
    return (
      <form action={verifyAction} className="flex flex-col gap-4">
        <p className="text-zinc-600 dark:text-zinc-400">
          We sent a 6-digit code to <strong>{requested.email}</strong>. It works for 5 minutes. Use the newest email:
          asking for a new code cancels the old one.
        </p>
        <input type="hidden" name="email" value={requested.email} />
        <input type="hidden" name="mode" value={requested.mode} />
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
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <button type="submit" disabled={verifying || requesting} className={buttonClass}>
          {verifying ? "Checking…" : "Verify"}
        </button>
        {/* Submits the same form (with the hidden email) to the request action. */}
        <button type="submit" formAction={requestAction} formNoValidate disabled={verifying || requesting} className={linkClass}>
          {requesting ? "Sending…" : "Send a new code"}
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={requestAction} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2" hidden={!visitors}>
          <legend className="mb-1 text-sm font-medium">I am signing up with</legend>
          {MODES.filter((mode) => visitors || mode.value === "school").map((mode) => (
            <label key={mode.value} className="flex items-start gap-3 rounded-lg border border-zinc-300 px-3 py-3 dark:border-zinc-700">
              <input type="radio" name="mode" value={mode.value} defaultChecked={requested.mode === mode.value} className="mt-1 h-5 w-5 shrink-0" />
              <span className="flex flex-col">
                <span className="text-base font-medium">{mode.label}</span>
                <span className="text-xs text-zinc-500">{mode.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">{visitors ? "Email" : "School email"}</span>
          <input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@school.edu.ph"
            required
            autoFocus
            className={`${inputClass} placeholder:text-zinc-500`}
          />
          {visitors ? null : <span className="text-sm text-zinc-600 dark:text-zinc-400">Use the email your school gave you.</span>}
        </label>
        {requested.error ? <p role="alert" className="text-sm text-red-600">{requested.error}</p> : null}
        <button type="submit" disabled={requesting} className={buttonClass}>
          {requesting ? "Sending…" : "Send code"}
        </button>
      </form>
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href="/sign-in" className={inlineLinkClass}>
          Log in
        </Link>
      </p>
    </div>
  );
}
