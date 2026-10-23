"use client";

import { useState } from "react";
import { setHeartAction } from "@/app/social/actions";

/** A private heart. Shows the change at once and puts it back if the server refuses. `overlay` is the dark round look for sitting on a photo. */
export function HeartButton({ postId, initial, variant = "default" }: { postId: string; initial: boolean; variant?: "default" | "overlay" }) {
  const [hearted, setHearted] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !hearted;
    setHearted(next);
    setBusy(true);
    try {
      const result = await setHeartAction(postId, next);
      if (!result.ok) setHearted(!next);
    } catch {
      setHearted(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={hearted}
      aria-label={hearted ? "Remove heart" : "Heart this post"}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${variant === "overlay" ? "bg-black/50 text-white backdrop-blur-sm active:bg-black/60" : "border border-zinc-300 dark:border-zinc-700"}`}
    >
      <svg viewBox="0 0 24 24" className={`h-6 w-6 ${hearted ? "fill-red-500 stroke-red-500" : "fill-none stroke-current"}`} strokeWidth="2" aria-hidden>
        <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3 5 6.5 5c2 0 3.5 1.1 5.5 3.2C14 6.1 15.5 5 17.5 5 21 5 22.8 8.6 21.5 11.8 19.5 16.4 12 21 12 21z" />
      </svg>
    </button>
  );
}
