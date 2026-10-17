"use client";

import { useState } from "react";
import { deletePostAction } from "@/app/posts/actions";

export function DeleteButton({ postId, title }: { postId: string; title: string }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm(`Delete "${title}" from your list? Messages about it stay in your conversations.`)) return;
    setBusy(true);
    setFailed(null);
    try {
      const { ok, error } = await deletePostAction(postId);
      if (!ok) setFailed(error ?? "Could not delete. Try again.");
    } catch {
      setFailed("Could not delete. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="flex h-11 items-center justify-center rounded-lg border border-red-300 text-sm font-medium text-red-600 disabled:opacity-60 dark:border-red-900"
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      {failed ? <span className="text-xs text-red-600">{failed}</span> : null}
    </div>
  );
}
