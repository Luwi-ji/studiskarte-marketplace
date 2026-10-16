"use client";

import { useRef } from "react";
import { ProductCard } from "@/components/product-card";
import type { PostCard } from "@/lib/messaging/read";

/** A listing with its picture link, ready to show. */
export type PostCardData = { post: PostCard; thumbUrl: string };

/** A listing in this thread: from the viewer's side, with where its transaction stands. */
export type ListingCardData = PostCardData & { viewerIsOwner: boolean; state: string | null };

/**
 * The bar under the header: the listings the two have dealt about. Tapping it
 * opens the list, each listing with its state (an offer waiting, reserved…),
 * and each one opens the listing.
 */
export function Transactions({ listings }: { listings: ListingCardData[] }) {
  const sheet = useRef<HTMLDialogElement>(null);
  if (listings.length === 0) return null;
  const [latest] = listings;
  return (
    <>
      <button type="button" onClick={() => sheet.current?.showModal()} className="flex min-h-11 w-full items-center gap-3 text-left active:opacity-80">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={latest.thumbUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">Transactions</p>
          <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">{listings.length === 1 ? latest.post.title : `${listings.length} listings`}</p>
        </div>
        <span aria-hidden className="text-xl text-zinc-400">
          ›
        </span>
      </button>

      <dialog
        ref={sheet}
        aria-label="Transactions"
        className="m-0 mt-auto max-h-[90dvh] w-full max-w-none rounded-t-2xl bg-[var(--background)] p-0 text-[var(--foreground)] backdrop:bg-black/50"
      >
        <div className="mx-auto flex max-h-[90dvh] w-full max-w-md flex-col">
          <div className="flex items-center justify-between px-4 pt-2">
            <h2 className="text-lg font-semibold">Transactions</h2>
            <button type="button" onClick={() => sheet.current?.close()} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl">
              ×
            </button>
          </div>
          <ul className="flex flex-col gap-2 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
            {listings.map((l) => (
              <li key={l.post.id}>
                <p className="px-1 pb-1 text-xs text-zinc-500">{l.viewerIsOwner ? "Your post" : "Their post"}</p>
                <ProductCard post={l.post} thumbUrl={l.thumbUrl} state={l.state} />
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}
