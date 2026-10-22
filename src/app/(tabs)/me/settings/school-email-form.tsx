"use client";

import { useActionState } from "react";
import { ROLE_LABEL, SCHOOL_ROLES } from "@/lib/identity/roles";
import { confirmSchoolEmailAction, requestSchoolEmailAction, type SchoolEmailState } from "./actions";

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const button = "h-11 rounded-lg bg-brand px-4 text-base font-medium text-white disabled:opacity-60";

/** For a visitor: prove a school email with a code, then become a student, faculty, staff or alumni of that school. */
export function SchoolEmailForm() {
  const [requested, requestAction, requesting] = useActionState<SchoolEmailState, FormData>(requestSchoolEmailAction, { step: "email" });
  const [confirmed, confirmAction, confirming] = useActionState<SchoolEmailState, FormData>(confirmSchoolEmailAction, { step: "email" });

  const intro = (
    <>
      <span className="text-sm font-medium">Become a student</span>
      <p className="text-xs text-zinc-500">
        Add your school email to join your school. We send a code to it; your school email is never shown to others.
      </p>
    </>
  );

  if (requested.step === "code") {
    const error = confirmed.step === "code" && confirmed.email === requested.email ? confirmed.error : undefined;
    return (
      <form action={confirmAction} className="flex flex-col gap-3">
        {intro}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          We sent a 6-digit code to <strong>{requested.email}</strong>. It works for 10 minutes.
        </p>
        <input type="hidden" name="email" value={requested.email} />
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">I am a</span>
          <select name="role" defaultValue="student" className={input}>
            {SCHOOL_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Code</span>
          <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required autoFocus className={input} />
        </label>
        {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
        <div className="flex items-center gap-4">
          <button type="submit" disabled={confirming || requesting} className={button}>
            {confirming ? "Checking…" : "Verify"}
          </button>
          <button
            type="submit"
            formAction={requestAction}
            formNoValidate
            disabled={confirming || requesting}
            className="inline-flex min-h-11 items-center text-sm text-zinc-600 underline disabled:opacity-60 dark:text-zinc-400"
          >
            {requesting ? "Sending…" : "Send a new code"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={requestAction} className="flex flex-col gap-3">
      {intro}
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">School email</span>
        <input name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@school.edu.ph" required className={input} />
      </label>
      {requested.error ? <p role="alert" className="text-sm text-red-600">{requested.error}</p> : null}
      <button type="submit" disabled={requesting} className={`${button} self-start`}>
        {requesting ? "Sending…" : "Send code"}
      </button>
    </form>
  );
}
