"use client";

import { useRouter } from "next/navigation";
import { blockStudentAction, unblockStudentAction } from "./actions";
import { useAction } from "./use-action";

/** Blocks a student after a confirmation, then goes home: their posts and profile are gone from view. */
export function BlockButton({ handle, className }: { handle: string; className?: string }) {
  const router = useRouter();
  const step = useAction();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={step.busy}
        className={className ?? "h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium disabled:opacity-60 dark:border-zinc-700"}
        onClick={() => {
          if (!window.confirm(`Block @${handle}? You will not see each other's posts or profiles, and the conversation becomes read-only. They are not told.`)) return;
          void step.run(() => blockStudentAction(handle), () => router.push("/"), false);
        }}
      >
        {step.busy ? "Blocking…" : "Block"}
      </button>
      {step.error ? (
        <p role="alert" className="text-sm text-red-600">
          {step.error}
        </p>
      ) : null}
    </div>
  );
}

/** Lifts a block; the row it sits in disappears once the page refreshes. */
export function UnblockButton({ handle }: { handle: string }) {
  const step = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={step.busy}
        className="h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium disabled:opacity-60 dark:border-zinc-700"
        onClick={() => void step.run(() => unblockStudentAction(handle))}
      >
        {step.busy ? "Unblocking…" : "Unblock"}
      </button>
      {step.error ? (
        <p role="alert" className="text-sm text-red-600">
          {step.error}
        </p>
      ) : null}
    </div>
  );
}
