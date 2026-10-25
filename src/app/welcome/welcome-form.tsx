"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Disclosure } from "@/components/auth-steps";
import { AGE_CHECKBOX, UNDER_18_NOTICE } from "@/lib/identity/age";
import { DISPLAY_NAME_MAX, HANDLE_MAX } from "@/lib/identity/names";
import { ROLE_LABEL, SCHOOL_ROLES, type SchoolRole } from "@/lib/identity/roles";
import { finishSignUp, type WelcomeState } from "./actions";

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

/** `terms` is the version of the legal documents to accept, or null when there are none. `askRole` is true for someone with a school email; `defaultRole` is what they picked at sign-up. */
export function WelcomeForm({ terms, askRole, defaultRole, next }: { terms: string | null; askRole: boolean; defaultRole: SchoolRole; next: string | null }) {
  const [state, action, pending] = useActionState<WelcomeState, FormData>(finishSignUp, {
    values: { handle: "", displayName: "" },
  });
  const [role, setRole] = useState<SchoolRole>(defaultRole);
  const errorFor = (field: "handle" | "displayName" | "terms" | "age") =>
    state.error?.field === field ? (
      <p role="alert" className="text-sm text-red-600">
        {state.error.message}
      </p>
    ) : null;

  return (
    <form action={action} className="flex flex-col gap-6">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {askRole ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">I am a</legend>
          <div className="flex flex-wrap gap-2">
            {SCHOOL_ROLES.map((r) => (
              <label key={r} className="cursor-pointer">
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="peer sr-only" />
                <span className="inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-4 text-base font-medium transition-colors peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand peer-focus-visible:ring-offset-2 dark:border-zinc-700">
                  {ROLE_LABEL[r]}
                </span>
              </label>
            ))}
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{role === "student" ? "Students can buy, sell and post Wishlists." : "You can buy and post Wishlists. Selling is for students."}</p>
        </fieldset>
      ) : null}
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Handle</span>
        <div className="flex items-center gap-2">
          <span className="text-lg text-zinc-500">@</span>
          <input
            name="handle"
            defaultValue={state.values.handle}
            required
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={HANDLE_MAX + 1}
            placeholder="your_handle"
            className={input}
          />
        </div>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">3 to 20 letters, numbers, dots or underscores.</span>
        {errorFor("handle")}
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">Display name</span>
        <input name="displayName" defaultValue={state.values.displayName} required autoComplete="name" maxLength={DISPLAY_NAME_MAX * 4} className={input} />
        <span className="text-sm text-zinc-600 dark:text-zinc-400">How other students see you.</span>
        {errorFor("displayName")}
      </label>

      {terms ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-900">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="terms" value={terms} required className="mt-1 h-5 w-5 shrink-0" />
            <span className="text-sm">
              I accept the{" "}
              <Link href="/legal/terms" target="_blank" className="underline">
                Terms
              </Link>
              ,{" "}
              <Link href="/legal/privacy" target="_blank" className="underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/legal/guidelines" target="_blank" className="underline">
                Community Guidelines
              </Link>
              .
            </span>
          </label>
          <label className="flex items-start gap-3">
            <input type="checkbox" name="age" required className="mt-1 h-5 w-5 shrink-0" />
            <span className="text-sm">{AGE_CHECKBOX}</span>
          </label>
          {errorFor("terms")}
          {errorFor("age")}
          <details className="text-sm text-zinc-600 dark:text-zinc-400">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium">Under 18?</summary>
            <p className="pb-2">
              {UNDER_18_NOTICE}{" "}
              <Link href="/legal/child-safety" target="_blank" className="underline">
                Child Safety Standards
              </Link>
              .
            </p>
          </details>
        </div>
      ) : null}

      <Disclosure summary="Safety in three lines">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Meet in a public place, between 6:00 AM and 8:00 PM.</li>
          <li>The app never handles money.</li>
          <li>The owner reads reports within 24 hours.</li>
        </ul>
      </Disclosure>

      <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand px-3 py-3 text-base font-medium text-white disabled:opacity-60">
        {pending ? "Saving…" : "Finish"}
      </button>
    </form>
  );
}
