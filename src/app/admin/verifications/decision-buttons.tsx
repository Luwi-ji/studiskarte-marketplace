"use client";

import { useRouter } from "next/navigation";
import { useAction } from "@/app/safety/use-action";
import { decideCheckAction } from "./actions";

const APPROVE_CONFIRM = "Approve? This confirms their identity, role and that they meet the minimum age. The pictures are deleted now.";

/** Approve or reject one ID check; goes back to the list when it worked. Errors show under the buttons. */
export function DecisionButtons({ id }: { id: string }) {
  const step = useAction();
  const router = useRouter();
  const done = () => router.push("/admin/verifications");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={step.busy}
          className="h-11 flex-1 rounded-lg bg-brand px-3 text-sm font-medium text-white disabled:opacity-60"
          onClick={() => {
            if (!window.confirm(APPROVE_CONFIRM)) return;
            void step.run(() => decideCheckAction(id, "approve"), done, false);
          }}
        >
          {step.busy ? "Working…" : "Approve"}
        </button>
        <button
          type="button"
          disabled={step.busy}
          className="h-11 flex-1 rounded-lg border border-red-300 px-3 text-sm font-medium text-red-700 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
          onClick={() => {
            const answer = window.prompt("Why is it rejected? The member will read this. (required)");
            if (answer === null) return;
            const reason = answer.trim();
            if (reason === "") return;
            void step.run(() => decideCheckAction(id, "reject", reason), done, false);
          }}
        >
          Reject
        </button>
      </div>
      {step.error ? (
        <p role="alert" className="text-sm text-red-600">
          {step.error}
        </p>
      ) : null}
    </div>
  );
}
