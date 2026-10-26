"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Disclosure, StepHeader } from "@/components/auth-steps";
import { Turnstile } from "@/components/turnstile";
import { buttonClass, inlineLinkClass, inputClass, linkClass } from "../auth-styles";
import { requestCode, verifyCode, type SignUpState } from "./actions";
import { CHOOSABLE_ROLES, ROLE_LABEL, type Role } from "@/lib/identity/roles";

// What each role can do. Shown for the chosen role only, so the page stays short.
const ABILITY: Record<Role, string> = {
  student: "Buy, sell and post Wishlists.",
  faculty: "Buy and post Wishlists. Selling is for students.",
  staff: "Buy and post Wishlists. Selling is for students.",
  alumni: "Buy and post Wishlists. Selling is for students.",
  visitor: "Buy and post Wishlists. Selling is for students.",
};

/** `visitors` is false while sign-up with a personal email is closed (ALLOW_VISITORS). */
export function SignUpForm({ visitors, next }: { visitors: boolean; next: string | null }) {
  const [requested, requestAction, requesting] = useActionState<SignUpState, FormData>(requestCode, {
    step: "email",
    role: "student",
  });
  const [verified, verifyAction, verifying] = useActionState<SignUpState, FormData>(verifyCode, {
    step: "email",
    role: "student",
  });
  const [role, setRole] = useState<Role>(requested.role);

  // The code step belongs to the address just requested; its errors come from verifyAction.
  if (requested.step === "code") {
    const error = verified.step === "code" && verified.email === requested.email ? verified.error : undefined;
    return (
      <form action={verifyAction} className="flex flex-col gap-6">
        <StepHeader
          step={2}
          title="Check your email"
          subtitle={
            <>
              Enter the 6-digit code we sent to <strong className="break-all text-[var(--foreground)]">{requested.email}</strong>.
            </>
          }
        />
        <input type="hidden" name="email" value={requested.email} />
        <input type="hidden" name="role" value={requested.role} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label className="flex flex-col gap-2">
          <span className="sr-only">Code</span>
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            required
            autoFocus
            placeholder="000000"
            className={`${inputClass} text-center text-2xl font-semibold tracking-[0.5em] placeholder:tracking-[0.5em] placeholder:text-zinc-300 dark:placeholder:text-zinc-700`}
          />
        </label>
        <Turnstile action="signup" resetKey={requesting ? 1 : 0} />
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <div className="flex flex-col gap-2">
          <button type="submit" disabled={verifying || requesting} className={buttonClass}>
            {verifying ? "Checking…" : "Verify"}
          </button>
          {/* Submits the same form (with the hidden email) to the request action. */}
          <button type="submit" formAction={requestAction} formNoValidate disabled={verifying || requesting} className={linkClass}>
            {requesting ? "Sending…" : "Send a new code"}
          </button>
        </div>
        <Disclosure summary="Not getting the code?">
          <p>The code works for 5 minutes. Check your spam folder, and use the newest email: asking for a new code cancels the old one.</p>
        </Disclosure>
      </form>
    );
  }

  const needsSchoolEmail = !(role === "visitor" && visitors);
  return (
    <div className="flex flex-col gap-6">
      <StepHeader step={1} title="Create your account" subtitle="Tell us who you are and where to send a code." />
      <form action={requestAction} className="flex flex-col gap-6">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">I am a</legend>
          <div className="flex flex-wrap gap-2">
            {CHOOSABLE_ROLES.map((r) => (
              <label key={r} className="cursor-pointer">
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="peer sr-only" />
                <span className="inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-4 text-base font-medium transition-colors peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 dark:border-zinc-700">
                  {ROLE_LABEL[r]}
                </span>
              </label>
            ))}
          </div>
          <p role="status" className="rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {ABILITY[role]} {needsSchoolEmail ? "Needs a school email." : "Works with a school or personal email."}
          </p>
        </fieldset>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Email</span>
          <input
            name="email"
            defaultValue={requested.email}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={needsSchoolEmail ? "you@school.edu.ph" : "you@email.com"}
            required
            className={`${inputClass} placeholder:text-zinc-500`}
          />
          <span className="text-sm text-zinc-600 dark:text-zinc-400">{needsSchoolEmail ? "Use the email your school gave you." : "A school email also earns a badge."}</span>
        </label>
        <Turnstile action="signup" resetKey={requesting ? 1 : 0} />
        {requested.error ? <p role="alert" className="text-sm text-red-600">{requested.error}</p> : null}
        <button type="submit" disabled={requesting} className={buttonClass}>
          {requesting ? "Sending…" : "Send code"}
        </button>
        <Disclosure summary="Why a school email?">
          <p>It proves you are a student, and your profile shows a School email badge. We never show the address to other members.</p>
          {visitors ? <p>No school email? Choose Guest. Guests can buy and post Wishlists, but cannot sell.</p> : null}
        </Disclosure>
      </form>
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link href={next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in"} className={inlineLinkClass}>
          Log in
        </Link>
      </p>
    </div>
  );
}
