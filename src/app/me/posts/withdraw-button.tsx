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
    <>
      <button type="button" onClick={withdraw} disabled={busy} className="text-sm text-red-600 underline disabled:opacity-60">
        {busy ? "Withdrawing…" : "Withdraw"}
      </button>
      {failed ? <span className="text-xs text-red-600">Could not withdraw. Try again.</span> : null}
    </>
  );
}
