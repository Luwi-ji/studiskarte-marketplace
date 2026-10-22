"use client";

import { useEffect, useState } from "react";
import { unblockStudentAction } from "./actions";

const BLOCKED_EVENT = "studiskarte:blocked";
const SHOW_MS = 8000;

/** Tells the notice (mounted once in the root layout, so it survives the move to the previous screen) that a student was just blocked. */
export function announceBlocked(handle: string) {
  window.dispatchEvent(new CustomEvent<string>(BLOCKED_EVENT, { detail: handle }));
}

/**
 * One line at the top of whatever screen the student lands on after blocking:
 * "Blocked @name. Undo", for 8 seconds. Undo lifts the block; a reservation the
 * block already cancelled stays cancelled.
 */
export function BlockedNotice() {
  const [state, setState] = useState<{ handle: string; undone: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onBlocked = (event: Event) => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== "string") return;
      setState({ handle: event.detail, undone: false });
      setBusy(false);
      setFailed(false);
    };
    window.addEventListener(BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(BLOCKED_EVENT, onBlocked);
  }, []);

  // Each new notice, and each change to it, gets a fresh 8 seconds; a failed undo stays until dismissed.
  useEffect(() => {
    if (!state || busy || failed) return;
    const timer = setTimeout(() => setState(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [state, busy, failed]);

  if (!state) return null;

  async function undo() {
    if (!state) return;
    setBusy(true);
    setFailed(false);
    try {
      const result = await unblockStudentAction(state.handle);
      if (result.ok) setState({ handle: state.handle, undone: true });
      else setFailed(true);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  }

  return (
    <div
      role="status"
      className="fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 mx-auto flex max-w-md items-center justify-between gap-2 rounded-xl bg-zinc-900 py-1 pl-4 pr-1 text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
    >
      <span className="min-w-0 py-2">
        {state.undone ? `Unblocked @${state.handle}.` : failed ? "Could not undo. You can unblock in Settings." : `Blocked @${state.handle}.`}
      </span>
      <span className="flex shrink-0 items-center">
        {state.undone || failed ? null : (
          <button type="button" disabled={busy} onClick={() => void undo()} className="h-11 rounded-lg px-3 font-medium underline disabled:opacity-60">
            {busy ? "Undoing…" : "Undo"}
          </button>
        )}
        <button type="button" onClick={() => setState(null)} aria-label="Dismiss" className="flex h-11 w-11 items-center justify-center text-xl">
          <span aria-hidden>×</span>
        </button>
      </span>
    </div>
  );
}
