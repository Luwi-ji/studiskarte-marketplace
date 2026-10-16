"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { acceptOfferAction, cancelDealAction, declineOfferAction, withdrawOfferAction } from "@/app/deals/actions";
import { ProductCard } from "@/components/product-card";
import { formatPrice } from "@/lib/posts/format";
import type { PostCardData } from "./transactions";

export type OfferCardData = {
  id: string;
  /** Per unit. */
  amount: number;
  quantity: number;
  isReserve: boolean;
  status: string;
  expiresAt: string;
  /** The reservation made when this offer was accepted. */
  deal: { id: string; status: string } | null;
  /** The listing it is on. */
  listing: PostCardData;
  /** The viewer is the listing's owner (decides the offer); otherwise they made it. */
  viewerIsOwner: boolean;
};

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
  /** Who made it, as the viewer should read it. */
  responderName: string;
};

/**
/**
 * An offer inside the conversation, with the listing it is on (tap it to open
 * the listing). Its state is always the current one. The owner can accept
 * (after a confirming tap) or decline a pending offer; the one who made it can
 * withdraw it.
 */
export function OfferCardView({ offer, responderName }: Props) {
  const { viewerIsOwner } = offer;
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [busy, setBusy] = useState<"accept" | "decline" | "withdraw" | "cancel" | null>(null);
  // The reservation as we last changed it, until the server's answer arrives.
  const [dealDone, setDealDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What we just did, shown at once; the server's answer takes over when it arrives with a final state.
  const [done, setDone] = useState<string | null>(null);
  const status = offer.status !== "pending" ? offer.status : (done ?? "pending");

  async function run(kind: "accept" | "decline" | "withdraw" | "cancel") {
    setBusy(kind);
    setError(null);
    try {
      const result =
        kind === "cancel"
          ? await cancelDealAction(offer.deal?.id)
          : await (kind === "accept" ? acceptOfferAction : kind === "decline" ? declineOfferAction : withdrawOfferAction)(offer.id);
      if (!result.ok) setError(result.error);
      else {
        if (kind === "cancel") setDealDone("cancelled");
        else setDone(kind === "accept" ? "accepted" : kind === "decline" ? "declined" : "withdrawn");
        // The Transactions bar and the other cards read the new state now, not at the next refresh.
        router.refresh();
      }
      setConfirming(false);
      setConfirmingCancel(false);
    } catch {
      setError("Could not do that. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const qty = offer.quantity;
  const many = qty > 1;
  const free = offer.isReserve && offer.amount === 0;
  const each = formatPrice("amount", offer.amount);
  const total = formatPrice("amount", offer.amount * qty);
  const supply = offer.listing.post.kind === "wishlist";
  let title: string;
  if (offer.isReserve) {
    if (free) title = supply ? `Offers to supply ${many ? qty : "it"}` : many ? `Reserve ${qty}` : "Reserve request";
    else if (supply) title = many ? `Offers to supply ${qty} at ${each} each (${total})` : `Offers to supply it at ${each}`;
    else title = many ? `Reserve ${qty} × ${each} = ${total}` : `Reserve at ${each}`;
  } else if (supply) {
    title = many ? `Offers ${each} each to supply ${qty} (${total})` : `Offers ${each} to supply it`;
  } else {
    title = many ? `Offer: ${each} each × ${qty} = ${total}` : `Offer: ${each}`;
  }
  const who = viewerIsOwner ? responderName : "You";

  const statusText: Record<string, string> = {
    pending: viewerIsOwner ? `Waiting for you. Expires ${timeLeft(offer.expiresAt)}.` : `Waiting for the owner. Expires ${timeLeft(offer.expiresAt)}.`,
    accepted: viewerIsOwner
      ? `Accepted. ${many ? `${qty} are reserved for ${responderName}.` : "Reserved for them."} Agree a time and place in this chat.`
      : `Accepted! ${many ? `${qty} are reserved for you.` : "It is reserved for you."} Agree a time and place in this chat.`,
    declined: viewerIsOwner ? "You declined this." : "The owner declined this.",
    withdrawn: viewerIsOwner ? `${responderName} withdrew this.` : "You withdrew this.",
    expired: "This offer expired.",
  };

  // A reservation can be cancelled after it was accepted; that is its own, final state.
  const dealStatus = dealDone ?? offer.deal?.status ?? null;
  const cancelled = status === "accepted" && dealStatus === "cancelled";
  const canCancel = status === "accepted" && offer.deal !== null && (dealStatus === "agreed" || dealStatus === "scheduled");
  const settled = status !== "pending";
  return (
    <div className={`w-[85%] rounded-2xl border p-3 ${status === "accepted" && !cancelled ? "border-green-600" : "border-zinc-300 dark:border-zinc-700"} bg-[var(--background)]`}>
      <p className="text-xs text-zinc-500">{who}</p>
      <div className="mb-1">
        <ProductCard post={offer.listing.post} thumbUrl={offer.listing.thumbUrl} compact />
      </div>
      <p className="text-lg font-semibold">{title}</p>
      <p className={`text-sm ${(settled && status !== "accepted") || cancelled ? "text-zinc-500" : ""}`}>{cancelled ? "Reservation cancelled. The units went back to the post." : (statusText[status] ?? "")}</p>

      {status === "pending" && viewerIsOwner ? (
        confirming ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm">
              Accept and reserve {offer.quantity > 1 ? offer.quantity : "it"} for {responderName}? If that uses the last one, the other offers are declined.
            </p>
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

      {canCancel && !cancelled ? (
        confirmingCancel ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm">Cancel this reservation? {viewerIsOwner ? "The units go back to your post." : "The seller is told."}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={busy !== null} onClick={() => setConfirmingCancel(false)} className="h-11 rounded-lg border border-zinc-300 font-medium dark:border-zinc-700">
                Keep it
              </button>
              <button type="button" disabled={busy !== null} onClick={() => run("cancel")} className="h-11 rounded-lg border border-red-300 font-medium text-red-600 disabled:opacity-60 dark:border-red-900">
                {busy === "cancel" ? "Cancelling…" : "Yes, cancel"}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" disabled={busy !== null} onClick={() => setConfirmingCancel(true)} className="mt-3 h-11 w-full rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700">
            Cancel reservation
          </button>
        )
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
