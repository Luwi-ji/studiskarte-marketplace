"use client";

import { useState } from "react";
import { reportPostAction, reportStudentAction } from "./actions";
import { useAction } from "./use-action";

const DETAILS_MAX = 500;
const button = "h-11 rounded-lg border border-zinc-300 font-medium disabled:opacity-60 dark:border-zinc-700";
const primary = "h-11 rounded-lg bg-brand font-medium text-white disabled:opacity-60";
const field = "h-11 w-full rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700";

export type ReportTarget = { kind: "post"; postId: string } | { kind: "student"; handle: string };

/** A button that opens a small form to report a post or a student to the admins. The reasons come from the server component that renders it. */
export function ReportButton({ target, reasons, label = "Report", className }: { target: ReportTarget; reasons: readonly { id: string; label: string }[]; label?: string; className?: string }) {
  const step = useAction();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) return <p className="text-sm text-zinc-600 dark:text-zinc-400">Thanks. We will review it.</p>;

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
              () => setSent(true),
              false,
            );
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            What is wrong?
            <select name="reason" required defaultValue="" className={field}>
              <option value="" disabled>
                Choose
              </option>
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
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
