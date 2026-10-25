"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { TurnChip } from "@/components/turn-chip";
import type { Turn } from "@/lib/deals/turn";

export type OngoingRow = {
  /** The deal's id, or the offer's while it is only an offer. */
  id: string;
  /** The thread's card for it is anchored on this. */
  offerId: string;
  title: string;
  kind: string;
  thumbUrl: string;
  otherName: string;
  otherHandle: string | null;
  turn: Turn;
  chip: string;
  state: string;
  conversationId: string;
};

const BUTTON = "ongoing-transactions-button";
const KIND: Record<string, string> = { showcase: "bg-brand text-white", wishlist: "bg-amber-400 text-amber-950" };

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * The header icon of Messages and the sheet it opens: every offer waiting for an answer and every reservation being
 * carried out, "Your turn" ones first. The badge counts those that wait for the viewer. A row opens its conversation
 * at that transaction's card. The rows come from the server, so the sheet opens with them already there.
 */
export function OngoingTransactions({ rows }: { rows: OngoingRow[] }) {
  const [open, setOpen] = useState(false);
  const mine = rows.filter((row) => row.turn === "mine").length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={mine > 0 ? `Ongoing transactions, ${mine} need your action` : "Ongoing transactions"}
        aria-haspopup="dialog"
        className={`${BUTTON} press relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full`}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 6h11M9 12h11M9 18h11M3.5 6 5 7.5 7.5 4.5M3.5 12 5 13.5l2.5-3M3.5 18 5 19.5l2.5-3" />
        </svg>
        {mine > 0 ? (
          <span aria-hidden className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
            {mine > 9 ? "9+" : mine}
          </span>
        ) : null}
      </button>
      {/* In the page header, which is sticky and blurred: the sheet lives in the body instead (docs/design/interaction.md). */}
      <BottomSheet open={open} onOpenChange={setOpen} label="Ongoing transactions" returnFocusTo={`.${BUTTON}`} portal>
        <div data-sheet-drag className="flex min-h-12 shrink-0 items-center gap-1 px-2">
          <span className="w-2" />
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">Ongoing transactions</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close ongoing transactions" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <CloseIcon />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
              <p className="font-medium">No ongoing transactions</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Offers waiting for an answer and reservations you are carrying out show up here.</p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/messages/${row.conversationId}#offer-${row.offerId}`}
                    onClick={() => setOpen(false)}
                    className="press-row flex min-h-20 items-start gap-3 px-4 py-3"
                  >
                    <img src={row.thumbUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center justify-between gap-2">
                        <TurnChip turn={row.turn} neutral={row.chip} />
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${KIND[row.kind] ?? KIND.showcase}`}>{row.kind === "wishlist" ? "Wishlist" : "Showcase"}</span>
                      </span>
                      <span className="line-clamp-2 font-medium leading-snug">{row.title}</span>
                      <span className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                        {row.otherName}
                        {row.otherHandle && row.otherName !== `@${row.otherHandle}` ? ` · @${row.otherHandle}` : ""}
                      </span>
                      <span className="line-clamp-2 text-xs text-zinc-500">{row.state}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-zinc-200 dark:border-zinc-800">
            <Link href="/me/transactions" onClick={() => setOpen(false)} className="press-row flex min-h-12 items-center justify-center px-4 text-sm font-medium text-brand-text">
              All transactions, including finished ones
            </Link>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
