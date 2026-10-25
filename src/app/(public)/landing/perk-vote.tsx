"use client";

import { useState } from "react";
import { PERK_KINDS, type PerkKind } from "@/lib/perks/kinds";

export function PerkVote() {
  const [voted, setVoted] = useState<ReadonlySet<PerkKind>>(new Set());
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function vote(kind: PerkKind) {
    try {
      const response = await fetch("/api/funnel/perk-vote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setVoted((prev) => new Set(prev).add(kind));
      setMessage({ text: "Thanks, noted.", ok: true });
    } catch {
      setMessage({ text: "Could not save your vote. Try again.", ok: false });
    }
  }

  return (
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
      {message?.ok ? (
        <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
          {message.text}
        </p>
      ) : null}
      {message && !message.ok ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
