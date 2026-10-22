"use client";

import { useState } from "react";
import { reportPostAction, reportStudentAction } from "./actions";
import { BlockButton } from "./block-button";
import { useAction } from "./use-action";

const DETAILS_MAX = 500;
/** The reason id that CHILD_SAFETY_REASON names on the server (that module reads the database, so the browser cannot import it). */
const CHILD_SAFETY_ID = "child_safety";
const button = "h-11 rounded-lg border border-zinc-300 font-medium disabled:opacity-60 dark:border-zinc-700";
const primary = "h-11 rounded-lg bg-brand font-medium text-white disabled:opacity-60";
const blockStyle = "h-11 w-full rounded-lg border border-red-300 text-sm font-medium text-red-600 dark:border-red-900";

export type ReportTarget = { kind: "post"; postId: string } | { kind: "student"; handle: string };

/** A button that opens a small form to report a post or a student to the admins. The reasons come from the server component that renders it. */
export function ReportButton({ target, reasons, label = "Report", className }: { target: ReportTarget; reasons: readonly { id: string; label: string }[]; label?: string; className?: string }) {
  const step = useAction();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<{ childSafety: boolean } | null>(null);

  if (sent) {
    return (
      <div role="status" className="flex flex-col gap-2 rounded-xl border border-zinc-300 p-3 text-left text-sm dark:border-zinc-700">
        <p>
          <span className="font-semibold">Report sent.</span>{" "}
          {sent.childSafety
            ? "The owner aims to read child safety reports within 24 hours."
            : "The owner aims to read urgent reports within 24 hours and others within 3 working days."}{" "}
          The other student is not told who reported. If you are in danger now, leave the place and call 911.
        </p>
        {target.kind === "student" ? (
          <BlockButton handle={target.handle} label="Block this student" className={blockStyle} />
        ) : (
          <BlockButton postId={target.postId} label="Block the person who posted this" className={blockStyle} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {open ? null : (
        <button type="button" className={className ?? `${button} px-4 text-sm`} onClick={() => setOpen(true)}>
          {label}
        </button>
      )}
      {open ? (
        <form
          className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 text-left dark:border-zinc-800"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const input = { reason: data.get("reason"), details: data.get("details") };
            void step.run(
              () => (target.kind === "post" ? reportPostAction(target.postId, input) : reportStudentAction(target.handle, input)),
              () => setSent({ childSafety: input.reason === CHILD_SAFETY_ID }),
              false,
            );
          }}
        >
          <fieldset className="flex flex-col gap-1.5 text-sm">
            <legend className="mb-1">What is wrong?</legend>
            {reasons.map((r) => (
              <label key={r.id} className="flex min-h-11 items-start gap-3 rounded-lg border border-zinc-300 px-3 py-2.5 has-[:checked]:border-brand has-[:checked]:bg-zinc-100 dark:border-zinc-700 dark:has-[:checked]:bg-zinc-800">
                <input type="radio" name="reason" value={r.id} required className="mt-0.5 h-5 w-5 shrink-0" />
                {r.label}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1 text-sm">
            Tell us more (optional)
            <textarea name="details" rows={3} maxLength={DETAILS_MAX} className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700" />
          </label>
          {step.error ? (
            <p role="alert" className="text-sm text-red-600">
              {step.error}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={button} disabled={step.busy} onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className={primary} disabled={step.busy}>
              {step.busy ? "Sending…" : "Send report"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
