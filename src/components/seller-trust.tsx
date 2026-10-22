import Link from "next/link";
import { Stars } from "@/components/stars";
import { REPLY_LABEL, type ReplyBucket } from "@/lib/messaging/response-time";

/** Shown instead of empty stars for someone with no reviews and no handovers yet. */
export function NewPill() {
  return <span className="inline-flex h-6 items-center rounded-full bg-brand/10 px-2.5 text-xs font-medium text-brand-text">New</span>;
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
      {sold > 0 ? <span className="inline-flex min-h-11 items-center">Sold {sold}</span> : null}
      {replies ? <span className="inline-flex min-h-11 items-center">Replies {REPLY_LABEL[replies]}</span> : null}
    </div>
  );
}
