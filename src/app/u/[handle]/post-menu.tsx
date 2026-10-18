"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { deletePostAction, withdrawPostAction } from "@/app/posts/actions";

type Props = { postId: string; title: string; status: string; editLocked: boolean };

const item = "flex min-h-11 w-full items-center px-3 text-left text-sm font-medium";
const danger = `${item} text-red-600 disabled:opacity-60`;

/**
 * The "⋯" on one of the owner's own listings: edit, relist, withdraw or delete,
 * whichever the post's status allows. Posts with no action (reserved, fulfilled,
 * hidden, removed) show no menu at all.
 */
export function PostMenu({ postId, title, status, editLocked }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status !== "open" && status !== "expired" && status !== "withdrawn") return null;

  async function run(action: (id: string) => Promise<{ ok: boolean; error?: string }>, confirmText: string, fallback: string) {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    setFailed(null);
    try {
      const { ok, error } = await action(postId);
      if (ok) setOpen(false);
      else setFailed(error ?? fallback);
    } catch {
      setFailed(fallback);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={root} className="absolute right-1 top-1">
      <button
        type="button"
        aria-label={`Options for ${title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-white active:bg-black/20"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden style={{ filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.7))" }}>
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-10 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-[var(--background)] shadow-lg dark:border-zinc-700">
          {status === "open" ? (
            <>
              {editLocked ? (
                <p className="px-3 py-2 text-xs text-zinc-500">Edit locked: decline or cancel the offers and reservations first.</p>
              ) : (
                <Link role="menuitem" href={`/posts/${postId}/edit`} className={item}>
                  Edit
                </Link>
              )}
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                className={danger}
                onClick={() => run(withdrawPostAction, `Withdraw "${title}"? It leaves the feed for good and cannot be relisted.`, "Could not withdraw. Try again.")}
              >
                {busy ? "Withdrawing…" : "Withdraw"}
              </button>
            </>
          ) : null}
          {status === "expired" ? (
            <Link role="menuitem" href={`/posts/${postId}/edit`} className={`${item} text-brand-text`}>
              Relist for 30 days
            </Link>
          ) : null}
          {status === "expired" || status === "withdrawn" ? (
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              className={danger}
              onClick={() => run(deletePostAction, `Delete "${title}" from your list? Messages about it stay in your conversations.`, "Could not delete. Try again.")}
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          ) : null}
          {failed ? (
            <p role="alert" className="px-3 pb-2 text-xs text-red-600">
              {failed}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
