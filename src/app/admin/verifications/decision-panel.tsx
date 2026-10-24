"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/app/safety/use-action";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { decideCheckAction } from "./actions";

const REASON_MAX = 300;

/** The member reads whichever reason is sent. Each is a full sentence; the owner may edit it before sending. */
const PRESET_REASONS = [
  { label: "Cannot read it", text: "Your name or school cannot be read on the document. Take a clearer picture in good light." },
  { label: "Photo does not match", text: "The photo does not show you holding the same document." },
  { label: "Wrong document", text: "This is not a document we accept. Use your school ID or certificate of registration." },
  { label: "Name does not match", text: "The name on the document does not match your profile." },
  { label: "School does not match", text: "The school on the document does not match your school email." },
  { label: "Blurry or dark", text: "The picture is too blurry or too dark. Take it again in good light." },
  { label: "Age not shown", text: "The document does not show that you are old enough to use the app." },
] as const;

const APPROVE_CONFIRM = "Approving confirms their identity, role and that they meet the minimum age. The pictures are deleted now.";

/**
 * Approve or reject one ID check, pinned to the bottom of the review. Goes back to the list when it worked.
 * Rejecting needs a reason (the member reads it): pick one or write one. Errors show in the panel.
 */
export function DecisionPanel({ id }: { id: string }) {
  const step = useAction();
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [reason, setReason] = useState("");
  const done = () => router.push("/admin/verifications");
  const trimmed = reason.trim();

  return (
    <section aria-label="Decision" className="sticky bottom-0 z-10 -mx-4 border-t border-zinc-200 bg-[var(--background)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 dark:border-zinc-800">
      <div className="mx-auto flex max-w-xl flex-col gap-3">
        {rejecting ? (
          <>
            <p className="text-sm font-medium">Why is it rejected? The member will read this.</p>
            <ul className="flex flex-wrap gap-2">
              {PRESET_REASONS.map((preset) => (
                <li key={preset.label}>
                  <button
                    type="button"
                    aria-pressed={reason === preset.text}
                    onClick={() => setReason(preset.text)}
                    className={`flex h-11 items-center rounded-full border px-4 text-sm font-medium ${reason === preset.text ? "border-brand bg-brand text-white" : "border-zinc-300 dark:border-zinc-700"}`}
                  >
                    {preset.label}
                  </button>
                </li>
              ))}
            </ul>
            <textarea
              aria-label="Reason for rejecting"
              value={reason}
              maxLength={REASON_MAX}
              rows={3}
              placeholder="Pick a reason above or write your own (required)"
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-base dark:border-zinc-700"
            />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={step.busy} onClick={() => setRejecting(false)} className="flex h-12 items-center justify-center rounded-lg border-2 border-zinc-500 font-medium disabled:opacity-60 dark:border-zinc-400">
                Back
              </button>
              <button
                type="button"
                disabled={trimmed === "" || step.busy}
                aria-describedby="reject-reason-help"
                onClick={() => void step.run(() => decideCheckAction(id, "reject", trimmed), done, false)}
                className="flex h-12 items-center justify-center rounded-lg bg-red-700 font-medium text-white disabled:bg-zinc-200 disabled:text-zinc-600 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400"
              >
                {step.busy ? "Working…" : "Reject"}
              </button>
            </div>
            {trimmed === "" ? (
              <p id="reject-reason-help" className="text-sm text-zinc-600 dark:text-zinc-400">
                Pick or write a reason to reject.
              </p>
            ) : null}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={step.busy} onClick={() => setRejecting(true)} className="flex h-12 items-center justify-center rounded-lg border-2 border-red-700 font-medium text-red-700 disabled:opacity-60 dark:border-red-400 dark:text-red-400">
              Reject
            </button>
            <button type="button" disabled={step.busy} onClick={() => setConfirmApprove(true)} className="flex h-12 items-center justify-center rounded-lg bg-brand font-medium text-white disabled:opacity-60">
              {step.busy ? "Working…" : "Approve"}
            </button>
          </div>
        )}
        {step.error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {step.error}
          </p>
        ) : null}
      </div>
      <ConfirmSheet
        open={confirmApprove}
        onOpenChange={setConfirmApprove}
        title="Approve this ID check?"
        confirmLabel={step.busy ? "Working…" : "Approve"}
        cancelLabel="Not yet"
        busy={step.busy}
        onConfirm={() => {
          setConfirmApprove(false);
          void step.run(() => decideCheckAction(id, "approve"), done, false);
        }}
      >
        {APPROVE_CONFIRM}
      </ConfirmSheet>
    </section>
  );
}
