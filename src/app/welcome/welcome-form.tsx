"use client";

import { useActionState } from "react";
import { DISPLAY_NAME_MAX, HANDLE_MAX } from "@/lib/identity/names";
import { finishSignUp, type WelcomeState } from "./actions";

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

export function WelcomeForm() {
  const [state, action, pending] = useActionState<WelcomeState, FormData>(finishSignUp, {
    values: { handle: "", displayName: "" },
  });
  const errorFor = (field: "handle" | "displayName") =>
    state.error?.field === field ? (
      <p role="alert" className="text-sm text-red-600">
        {state.error.message}
      </p>
    ) : null;

  return (
    <form action={action} className="flex flex-col gap-5">
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
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-3 py-3 text-base font-medium text-white disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
