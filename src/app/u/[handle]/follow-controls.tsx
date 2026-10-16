"use client";

import { useState } from "react";
import { setFollowAction } from "@/app/social/actions";

/**
 * The follower count and the Follow button, kept together so the count moves
 * with the button at once. If the server refuses, both go back.
 */
export function FollowControls({ handle, initial, followerCount }: { handle: string; initial: boolean; followerCount: number }) {
  const [following, setFollowing] = useState(initial);
  const [count, setCount] = useState(followerCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !following;
    const change = next ? 1 : -1;
    setFollowing(next);
    setCount((n) => n + change);
    setBusy(true);
    try {
      const result = await setFollowAction(handle, next);
      if (!result.ok) throw new Error("refused");
    } catch {
      setFollowing(!next);
      setCount((n) => n - change);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className="text-sm">
        <span className="font-semibold">{count}</span> {count === 1 ? "follower" : "followers"}
      </p>
      <div className="w-full">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={following}
          className={`h-11 w-full rounded-lg font-medium ${
            following ? "border border-zinc-300 dark:border-zinc-700" : "bg-brand text-white"
          }`}
        >
          {following ? "Following" : "Follow"}
        </button>
      </div>
    </>
  );
}
