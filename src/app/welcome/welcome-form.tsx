"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AGE_CHECKBOX, UNDER_18_NOTICE } from "@/lib/identity/age";
import { DISPLAY_NAME_MAX, HANDLE_MAX } from "@/lib/identity/names";
import { ROLE_LABEL, SCHOOL_ROLES } from "@/lib/identity/roles";
import { finishSignUp, type WelcomeState } from "./actions";

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

/** `terms` is the version of the legal documents to accept, or null when there are none. `askRole` is true for someone with a school email. */
export function WelcomeForm({ terms, askRole }: { terms: string | null; askRole: boolean }) {
  const [state, action, pending] = useActionState<WelcomeState, FormData>(finishSignUp, {
    values: { handle: "", displayName: "" },
  });
  const errorFor = (field: "handle" | "displayName" | "terms" | "age") =>
    state.error?.field === field ? (
      <p role="alert" className="text-sm text-red-600">
        {state.error.message}
      </p>
    ) : null;

  return (
    <form action={action} className="flex flex-col gap-5">
      {askRole ? (
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
      ) : null}
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Handle</span>
        <div className="flex items-center gap-1">
          <span className="text-zinc-500">@</span>
          <input
            name="handle"
            defaultValue={state.values.handle}
            required
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={HANDLE_MAX + 1}
            className={input}
          />
        </div>
        <span className="text-xs text-zinc-500">
          3–20 letters, numbers, dots or underscores. You can change it later, once every 30 days.
        </span>
        {errorFor("handle")}
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">Display name</span>
        <input
          name="displayName"
          defaultValue={state.values.displayName}
          required
          autoComplete="name"
          maxLength={DISPLAY_NAME_MAX * 4}
          className={input}
        />
        <span className="text-xs text-zinc-500">How other students see you. You can change it any time.</span>
        {errorFor("displayName")}
      </label>
      {terms ? (
        <label className="flex items-start gap-3">
          <input type="checkbox" name="terms" value={terms} required className="mt-1 h-5 w-5 shrink-0" />
          <span className="text-sm">
            I accept the{" "}
            <Link href="/legal/terms" target="_blank" className="underline">
              Terms of Service
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
      ) : null}
      {terms ? (
        <label className="flex items-start gap-3">
          <input type="checkbox" name="age" required className="mt-1 h-5 w-5 shrink-0" />
          <span className="text-sm">
            {AGE_CHECKBOX} {UNDER_18_NOTICE}{" "}
            <Link href="/legal/child-safety" target="_blank" className="underline">
              Child Safety Standards
            </Link>
            .
          </span>
        </label>
      ) : null}
      {errorFor("terms")}
      {errorFor("age")}
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
