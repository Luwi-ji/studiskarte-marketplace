"use client";

import { useAction } from "@/app/safety/use-action";
import { dismissPostReportsAction, dismissStudentReportsAction, liftLegalHoldAction, placeLegalHoldAction, removePostAction, restorePostAction, restoreStudentAction, suspendStudentAction } from "./actions";

const ACTIONS = {
  restorePost: restorePostAction,
  removePost: removePostAction,
  dismissPost: dismissPostReportsAction,
  dismissStudent: dismissStudentReportsAction,
  suspendStudent: suspendStudentAction,
  restoreStudent: restoreStudentAction,
  placeHold: placeLegalHoldAction,
  liftHold: liftLegalHoldAction,
} as const;

export type AdminActionKind = keyof typeof ACTIONS;

/**
 * One admin decision on one post or student; asks first when `confirm` is given, and shows any error under the button.
 * `ask` opens a prompt for the reason (kept in the admin record; shown to the owner for a removed or restored post):
 * "required" refuses an empty answer, "optional" lets it be empty. Cancelling the prompt cancels the action. `compact` fits a table row.
 */
export function AdminButton({ kind, id, label, confirm, ask, danger, compact }: { kind: AdminActionKind; id: string; label: string; confirm?: string; ask?: "required" | "optional"; danger?: boolean; compact?: boolean }) {
  const step = useAction();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={step.busy}
        className={`rounded-lg border px-3 text-sm font-medium disabled:opacity-60 ${compact ? "h-9" : "h-11 w-full"} ${danger ? "border-red-300 text-red-700 dark:border-red-900 dark:text-red-400" : "border-zinc-300 dark:border-zinc-700"}`}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          let reason = "";
          if (ask) {
            const answer = window.prompt(ask === "required" ? "Why? (required, kept in the record)" : "Why? (optional, kept in the record)");
            if (answer === null) return;
            reason = answer.trim();
            if (ask === "required" && reason === "") {
              window.alert("A reason is required.");
              return;
            }
          }
          void step.run(() => ACTIONS[kind](id, reason));
        }}
      >
        {step.busy ? "Working…" : label}
      </button>
      {step.error ? (
        <p role="alert" className="text-sm text-red-600">
          {step.error}
        </p>
      ) : null}
    </div>
  );
}
