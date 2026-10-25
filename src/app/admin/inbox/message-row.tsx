"use client";

import { useAction } from "@/app/safety/use-action";
import { deleteContactMessageAction } from "./actions";

/** One landing-page note: who, when, the text, a reply link, and Delete for after it is answered. */
export function MessageRow({ id, name, email, message, when }: { id: string; name: string | null; email: string; message: string; when: string }) {
  const step = useAction();
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <p className="truncate font-semibold">{name || "No name given"}</p>
          <a href={`mailto:${email}`} className="truncate text-sm underline decoration-zinc-400 underline-offset-2">
            {email}
          </a>
        </div>
        <span className="shrink-0 text-xs text-zinc-500">{when}</span>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm">{message}</p>
      {step.error ? (
        <p role="alert" className="text-sm text-red-600">
          {step.error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <a href={`mailto:${email}`} className="flex h-11 flex-1 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-white">
          Reply
        </a>
        <button type="button" disabled={step.busy} onClick={() => void step.run(() => deleteContactMessageAction(id))} className="h-11 rounded-xl border border-zinc-300 px-4 text-sm font-medium disabled:opacity-50 dark:border-zinc-700">
          {step.busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </li>
  );
}
