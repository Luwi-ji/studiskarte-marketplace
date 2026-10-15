"use client";

import { useState } from "react";
import { withdrawPostAction } from "@/app/posts/actions";

export function WithdrawButton({ postId, title }: { postId: string; title: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function withdraw() {
    if (!window.confirm(`Withdraw "${title}"? It leaves the feed for good and cannot be relisted.`)) return;
    setBusy(true);
    setFailed(false);
    try {
      const { ok } = await withdrawPostAction(postId);
      if (!ok) setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={withdraw}
        disabled={busy}
        className="flex h-11 items-center justify-center rounded-lg border border-red-300 text-sm font-medium text-red-600 disabled:opacity-60 dark:border-red-900"
      >
        {busy ? "Withdrawing…" : "Withdraw"}
      </button>
      {failed ? <span className="text-xs text-red-600">Could not withdraw. Try again.</span> : null}
    </div>
  );
}
