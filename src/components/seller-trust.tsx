import Link from "next/link";
import { Stars } from "@/components/stars";
import { REPLY_LABEL, type ReplyBucket } from "@/lib/messaging/response-time";

/** Shown instead of empty stars for someone with no reviews and no handovers yet. */
export function NewPill() {
  return <span className="inline-flex h-6 items-center rounded-full bg-brand/10 px-2.5 text-xs font-medium text-brand-text">New</span>;
}

/** Items sold as a small bag-with-check icon and the number; the icon replaces the word "Sold". */
export function SoldCount({ count }: { count: number }) {
  return (
    <span role="img" aria-label={`${count} sold`} title={`${count} sold`} className="inline-flex items-center gap-1 text-sm">
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <path d="M3 6h18" />
        <path d="m9 14 2 2 4-4" />
      </svg>
      <span aria-hidden="true" className="font-medium text-zinc-900 dark:text-zinc-100">
        {count}
      </span>
    </span>
  );
}

/**
 * The cues that tell a stranger whether to trust a seller, on one line: stars
 * with the review count (or "New"), items sold, and how fast they usually reply.
 * Each part appears only when there is real data behind it.
 */
export function SellerTrust({
  handle,
  rating,
  sold,
  replies,
}: {
  handle: string | null;
  rating: { average: number; count: number } | null;
  sold: number;
  replies: ReplyBucket | null;
}) {
  const stars = <Stars average={rating?.average ?? null} count={rating?.count ?? 0} />;
  return (
    <div className="flex flex-wrap items-center gap-x-3 text-sm text-zinc-600 dark:text-zinc-400">
      {rating ? (
        handle ? (
          <Link href={`/u/${handle}/reviews`} className="inline-flex min-h-11 items-center active:opacity-80">
            {stars}
          </Link>
        ) : (
          stars
        )
      ) : sold === 0 ? (
        <span className="inline-flex min-h-11 items-center">
          <NewPill />
        </span>
      ) : null}
      {sold > 0 ? (
        <span className="inline-flex min-h-11 items-center">
          <SoldCount count={sold} />
        </span>
      ) : null}
      {replies ? <span className="inline-flex min-h-11 items-center">Replies {REPLY_LABEL[replies]}</span> : null}
    </div>
  );
}
