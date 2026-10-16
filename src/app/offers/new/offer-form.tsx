"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { makeOfferAction } from "@/app/deals/actions";
import type { OfferKind } from "@/lib/deals/rules";
import { MESSAGE_MAX } from "@/lib/messaging/rules";

const field =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

/** Sends an offer (with an amount) or a reserve (at the asking price), then opens the conversation. */
export function OfferForm({
  postId,
  kind,
  askingText,
  maxQuantity,
  limited,
  unitPrice,
}: {
  postId: string;
  kind: OfferKind;
  askingText: string;
  /** The most they can ask for (what is left, or 1,000 when ongoing). */
  maxQuantity: number;
  /** True when the post has a fixed number, so "N available" is worth saying. */
  limited: boolean;
  /** The post's price per unit, for the total of a reserve; null when it has none. */
  unitPrice: number | null;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [error, setError] = useState<{ field: "amount" | "quantity" | "note" | "form"; message: string } | null>(null);
  const [sending, setSending] = useState(false);

  function clear() {
    setAmount("");
    setQuantity("1");
    setNote("");
    setError(null);
  }

  // Pages the app has visited stay alive in the background. Leave nothing typed behind: the form
  // starts empty each time it is opened, and is emptied when it is left.
  useEffect(() => clear, []);

  // The total, when there is more than one and a price to multiply: the amount is per unit.
  const count = Number(quantity);
  const each = kind === "offer" ? Number(amount) : (unitPrice ?? 0);
  const total = count > 1 && each > 0 ? `Total: ₱${(count * each).toLocaleString("en-PH")} (₱${each.toLocaleString("en-PH")} each).` : "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await makeOfferAction(postId, { kind, amount, quantity, note });
      if (result.ok) {
        clear();
        router.replace(`/messages/${result.conversationId}`);
        return;
      }
      setError({ field: result.field ?? "form", message: result.error });
    } catch {
      setError({ field: "form", message: "Could not send. Check your connection and try again." });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-4" noValidate>
      {kind === "offer" ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{maxQuantity > 1 ? "Your offer for each (₱)" : "Your offer (₱)"}</span>
          <input
            name="amount"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 7));
              setError(null);
            }}
            placeholder="e.g. 450"
            aria-invalid={error?.field === "amount"}
            className={field}
          />
          <span className="text-xs text-zinc-500">{askingText}</span>
          {error?.field === "amount" ? (
            <p role="alert" className="text-sm text-red-600">
              {error.message}
            </p>
          ) : null}
        </label>
      ) : (
        <p className="rounded-lg bg-zinc-100 px-3 py-3 dark:bg-zinc-900">{askingText}</p>
      )}

      {maxQuantity > 1 ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">How many</span>
          <input
            name="quantity"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value.replace(/[^\d]/g, "").slice(0, 4));
              setError(null);
            }}
            aria-invalid={error?.field === "quantity"}
            className={field}
          />
          <span className="text-xs text-zinc-500">{limited ? `${maxQuantity} left.` : "No limit."}{total ? ` ${total}` : ""}</span>
          {error?.field === "quantity" ? (
            <p role="alert" className="text-sm text-red-600">
              {error.message}
            </p>
          ) : null}
        </label>
      ) : null}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Note (optional)</span>
        <textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MESSAGE_MAX}
          rows={3}
          placeholder="Add a message for the seller"
          className={field}
        />
        {error?.field === "note" ? (
          <p role="alert" className="text-sm text-red-600">
            {error.message}
          </p>
        ) : null}
      </label>

      <p className="text-xs text-zinc-500">
        Nothing is paid in the app. If the owner accepts, you agree a time and place in the chat, meet, and pay in person.
      </p>
      <div className="flex-1" />
      {error?.field === "form" ? (
        <p role="alert" className="text-sm text-red-600">
          {error.message}
        </p>
      ) : null}
      <div className="sticky bottom-0 border-t border-zinc-200 bg-[var(--background)] pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 dark:border-zinc-800">
        <button type="submit" disabled={sending} className="h-12 w-full rounded-lg bg-brand font-medium text-white disabled:opacity-60">
          {sending ? "Sending…" : kind === "offer" ? "Send offer" : "Reserve"}
        </button>
      </div>
    </form>
  );
}
