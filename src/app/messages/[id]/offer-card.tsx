"use client";

import { useState } from "react";
import { acceptOfferAction, declineOfferAction, withdrawOfferAction } from "@/app/deals/actions";
import { formatPrice } from "@/lib/posts/format";

export type OfferCardData = { id: string; amount: number; isReserve: boolean; status: string; expiresAt: string };

/** "in 3 days", "in 5 hours", or "soon". Days are rounded to the nearest, so a fresh 3-day offer reads "in 3 days". */
function timeLeft(expiresAt: string, now = Date.now()): string {
  const ms = new Date(expiresAt).getTime() - now;
  const day = 86_400_000;
  if (ms >= day) {
    const days = Math.round(ms / day);
    return `in ${days} ${days === 1 ? "day" : "days"}`;
  }
  const hours = Math.floor(ms / 3_600_000);
  return hours >= 1 ? `in ${hours} ${hours === 1 ? "hour" : "hours"}` : "soon";
}

type Props = {
  offer: OfferCardData;
  /** The viewer is the post's owner (decides the offer); otherwise they made it. */
  viewerIsOwner: boolean;
  /** Who made it, as the viewer should read it. */
  responderName: string;
  postKind: string;
};

/**
 * An offer inside the conversation. Its state is always the current one. The
 * owner can accept (after a confirming tap) or decline a pending offer; the
 * one who made it can withdraw it.
 */
export function OfferCardView({ offer, viewerIsOwner, responderName, postKind }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"accept" | "decline" | "withdraw" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What we just did, shown at once; the server's answer takes over when it arrives with a final state.
  const [done, setDone] = useState<string | null>(null);
  const status = offer.status !== "pending" ? offer.status : (done ?? "pending");

  async function run(kind: "accept" | "decline" | "withdraw") {
    setBusy(kind);
    setError(null);
    try {
      const act = kind === "accept" ? acceptOfferAction : kind === "decline" ? declineOfferAction : withdrawOfferAction;
      const result = await act(offer.id);
      if (result.ok) setDone(kind === "accept" ? "accepted" : kind === "decline" ? "declined" : "withdrawn");
      else setError(result.error);
      setConfirming(false);
    } catch {
      setError("Could not do that. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const price = offer.isReserve && offer.amount === 0 ? "free" : formatPrice("amount", offer.amount);
  const title = offer.isReserve
    ? postKind === "wishlist"
      ? `Offers to supply it at ${price}`
      : offer.amount === 0
        ? "Reserve request"
        : `Reserve at ${price}`
    : postKind === "wishlist"
      ? `Offers ${price} to supply it`
      : `Offer: ${price}`;
  const who = viewerIsOwner ? responderName : "You";

  const statusText: Record<string, string> = {
    pending: viewerIsOwner ? `Waiting for you. Expires ${timeLeft(offer.expiresAt)}.` : `Waiting for the owner. Expires ${timeLeft(offer.expiresAt)}.`,
    accepted: viewerIsOwner
      ? "Accepted. The post is reserved. Agree a time and place in this chat."
      : "Accepted! The post is reserved for you. Agree a time and place in this chat.",
    declined: viewerIsOwner ? "You declined this." : "The owner declined this.",
    withdrawn: viewerIsOwner ? `${responderName} withdrew this.` : "You withdrew this.",
    expired: "This offer expired.",
  };

  const settled = status !== "pending";
  return (
    <div className={`w-[85%] rounded-2xl border p-3 ${status === "accepted" ? "border-green-600" : "border-zinc-300 dark:border-zinc-700"} bg-[var(--background)]`}>
      <p className="text-xs text-zinc-500">{who}</p>
      <p className="text-lg font-semibold">{title}</p>
      <p className={`text-sm ${settled && status !== "accepted" ? "text-zinc-500" : ""}`}>{statusText[status] ?? ""}</p>

      {status === "pending" && viewerIsOwner ? (
        confirming ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm">Accept and reserve this post for {responderName}? Other offers will be declined.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={busy !== null} onClick={() => setConfirming(false)} className="h-11 rounded-lg border border-zinc-300 font-medium dark:border-zinc-700">
                Cancel
              </button>
              <button type="button" disabled={busy !== null} onClick={() => run("accept")} className="h-11 rounded-lg bg-brand font-medium text-white disabled:opacity-60">
                {busy === "accept" ? "Accepting…" : "Yes, accept"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy !== null} onClick={() => run("decline")} className="h-11 rounded-lg border border-zinc-300 font-medium disabled:opacity-60 dark:border-zinc-700">
              {busy === "decline" ? "Declining…" : "Decline"}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => setConfirming(true)} className="h-11 rounded-lg bg-brand font-medium text-white">
              Accept
            </button>
          </div>
        )
      ) : null}

      {status === "pending" && !viewerIsOwner ? (
        <button type="button" disabled={busy !== null} onClick={() => run("withdraw")} className="mt-3 h-11 w-full rounded-lg border border-zinc-300 font-medium disabled:opacity-60 dark:border-zinc-700">
          {busy === "withdraw" ? "Withdrawing…" : "Withdraw offer"}
        </button>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
