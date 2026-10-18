"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acceptTermsAction, type AcceptState } from "./actions";

export function AcceptForm({ version }: { version: string }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(acceptTermsAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {[
          ["terms", "Terms of Service"],
          ["privacy", "Privacy Policy"],
          ["guidelines", "Community Guidelines"],
        ].map(([slug, title]) => (
          <li key={slug}>
            <Link href={`/legal/${slug}`} target="_blank" className="flex h-11 items-center justify-between rounded-lg border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-700">
              {title}
              <span aria-hidden className="text-zinc-400">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <input type="hidden" name="terms" value={version} />
      {state.error ? (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand px-3 py-3 text-base font-medium text-white disabled:opacity-60">
        {pending ? "Saving…" : "I accept"}
      </button>
    </form>
  );
}
