"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cancelDealAction, withdrawOfferAction } from "@/app/deals/actions";
import type { MyTransaction } from "@/lib/deals/count";

/**
 * What a buyer sees at the bottom of a listing once they have an offer or
 * reservation on it: a way to see it, and a way to cancel it. Messaging the
 * seller happens from the offer's conversation, so there is no separate Message button.
 */
export function BuyerShortcuts({ transaction }: { transaction: MyTransaction }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const noun = transaction.isReserve ? "reservation" : "offer";

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      // A waiting offer is withdrawn; an accepted one is a reservation that is cancelled.
      const result = transaction.state === "accepted" && transaction.dealId ? await cancelDealAction(transaction.dealId) : await withdrawOfferAction(transaction.offerId);
      if (result.ok) router.refresh();
      else setError(result.error);
    } catch {
      setError("Could not cancel. Check your connection and try again.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-2">
        <p className="text-sm">
          Cancel your {noun}?{transaction.state === "accepted" ? " The seller is told." : ""}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="h-12 rounded-lg border border-zinc-300 font-medium dark:border-zinc-700">
            Keep it
          </button>
          <button type="button" disabled={busy} onClick={cancel} className="h-12 rounded-lg border border-red-300 font-medium text-red-600 disabled:opacity-60 dark:border-red-900">
            {busy ? "Cancelling…" : `Yes, cancel`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setConfirming(true)} className="h-12 rounded-lg border border-zinc-300 font-medium dark:border-zinc-700">
          Cancel {noun}
        </button>
        <Link href={`/messages/${transaction.conversationId}`} className="flex h-12 items-center justify-center rounded-lg bg-brand font-medium text-white">
          See {noun}
        </Link>
      </div>
      {error ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
