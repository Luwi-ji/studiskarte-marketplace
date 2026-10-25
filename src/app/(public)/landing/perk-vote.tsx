"use client";

import { useState } from "react";
import { PERK_KINDS, type PerkKind } from "@/lib/perks/kinds";

type Note = { text: string; ok: boolean } | null;

async function send(path: string, body: unknown): Promise<boolean> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function Message({ note }: { note: Note }) {
  if (!note) return null;
  return note.ok ? (
    <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
      {note.text}
    </p>
  ) : (
    <p role="alert" className="text-sm text-red-700 dark:text-red-400">
      {note.text}
    </p>
  );
}

export function PerkVote() {
  const [voted, setVoted] = useState<ReadonlySet<PerkKind>>(new Set());
  const [voteNote, setVoteNote] = useState<Note>(null);
  const [shop, setShop] = useState("");
  const [sending, setSending] = useState(false);
  const [shopNote, setShopNote] = useState<Note>(null);

  async function vote(kind: PerkKind) {
    if (await send("/api/funnel/perk-vote", { kind })) {
      setVoted((prev) => new Set(prev).add(kind));
      setVoteNote({ text: "Thanks, noted.", ok: true });
    } else {
      setVoteNote({ text: "Could not save your vote. Try again.", ok: false });
    }
  }

  async function suggest(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    const ok = await send("/api/funnel/perk-suggestion", { shop });
    setSending(false);
    if (ok) {
      setShop("");
      setShopNote({ text: "Thanks, we will ask them.", ok: true });
    } else {
      setShopNote({ text: "Could not save that. Check the name and try again.", ok: false });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {PERK_KINDS.map((perk) => {
            const pressed = voted.has(perk.id);
            return (
              <button
                key={perk.id}
                type="button"
                aria-pressed={pressed}
                disabled={pressed}
                onClick={() => vote(perk.id)}
                className="press min-h-11 rounded-full border border-zinc-300 px-4 text-base font-medium aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-white dark:border-zinc-700"
              >
                {perk.label}
              </button>
            );
          })}
        </div>
        <Message note={voteNote} />
      </div>

      <form onSubmit={suggest} className="flex flex-col gap-3">
        <label htmlFor="perk-shop" className="text-lg font-semibold">
          Which shop near TUP should we ask first?
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="perk-shop"
            value={shop}
            onChange={(event) => setShop(event.target.value)}
            maxLength={80}
            autoComplete="off"
            placeholder="Shop name"
            className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-4 text-base dark:border-zinc-700 dark:bg-zinc-950 sm:max-w-xs"
          />
          <button
            type="submit"
            disabled={sending || shop.trim().length < 2}
            className="press min-h-11 rounded-full bg-brand px-5 text-base font-semibold text-white disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
        <Message note={shopNote} />
      </form>
    </div>
  );
}
