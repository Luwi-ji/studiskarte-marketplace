"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buttonClass, inlineLinkClass, inputClass, linkClass } from "../auth-styles";
import { requestCode, verifyCode, type SignUpState } from "./actions";
import { CHOOSABLE_ROLES, ROLE_LABEL, type Role } from "@/lib/identity/roles";

// What each role can do, shown on its card. Only students can sell; the others buy and post Wishlists.
const ABILITY: Record<Role, string> = {
  student: "Buy, sell and post Wishlists",
  faculty: "Buy and post Wishlists. Cannot sell",
  staff: "Buy and post Wishlists. Cannot sell",
  alumni: "Buy and post Wishlists. Cannot sell",
  visitor: "Buy and post Wishlists. Cannot sell",
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
        <input type="hidden" name="role" value={requested.role} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
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
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">I am a</legend>
          {CHOOSABLE_ROLES.map((role) => (
            <label key={role} className="flex items-start gap-3 rounded-lg border border-zinc-300 px-3 py-3 dark:border-zinc-700">
              <input type="radio" name="role" value={role} defaultChecked={requested.role === role} className="mt-1 h-5 w-5 shrink-0" />
              <span className="flex flex-col">
                <span className="text-base font-medium">{ROLE_LABEL[role]}</span>
                <span className="text-xs text-zinc-500">
                  {ABILITY[role]} · {role === "visitor" && visitors ? "School or personal email" : "School email"}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Only students can sell. Everyone else can post a Wishlist, and can buy from a Showcase when its seller has opened it to non-students.
        </p>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            defaultValue={requested.email}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@school.edu.ph"
            required
            className={`${inputClass} placeholder:text-zinc-500`}
          />
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {visitors
              ? "Students, faculty, staff and alumni need a school email. As a Guest you can use a personal email."
              : "Use the email your school gave you."}
          </span>
        </label>
        {requested.error ? <p role="alert" className="text-sm text-red-600">{requested.error}</p> : null}
        <button type="submit" disabled={requesting} className={buttonClass}>
          {requesting ? "Sending…" : "Send code"}
        </button>
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
