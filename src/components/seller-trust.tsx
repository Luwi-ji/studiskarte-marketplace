import type { ReactNode } from "react";
import { Stars } from "@/components/stars";

/** Shown instead of empty stars for someone with no reviews and no handovers yet. */
export function NewPill() {
  return <span className="inline-flex h-6 items-center rounded-full bg-brand/10 px-2.5 text-xs font-medium text-brand-text">New</span>;
}

/** A small line icon and a number, read out as "<count> <label>"; the icon replaces the word. */
function IconCount({ count, label, children }: { count: number; label: string; children: ReactNode }) {
  return (
    <span role="img" aria-label={`${count} ${label}`} title={`${count} ${label}`} className="inline-flex items-center gap-1 text-sm">
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
      <span aria-hidden="true" className="font-medium text-zinc-900 dark:text-zinc-100">
        {count}
      </span>
    </span>
  );
}

/** A map pin, for where someone is based. */
export function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

/** Items sold as a small bag-with-check icon and the number; the icon replaces the word "Sold". */
export function SoldCount({ count }: { count: number }) {
  return (
    <IconCount count={count} label="sold">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="m9 14 2 2 4-4" />
    </IconCount>
  );
}

/** Items bought as a small shopping-cart icon and the number; the icon replaces the word "Bought". Shown beside SoldCount, and drawn differently from it. */
export function BoughtCount({ count }: { count: number }) {
  return (
    <IconCount count={count} label="bought">
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h8.1a2 2 0 0 0 2-1.5L21.5 7H6" />
    </IconCount>
  );
}

/** How many people follow someone, as a two-people icon and the number. */
export function FollowersCount({ count }: { count: number }) {
  return (
    <IconCount count={count} label={count === 1 ? "follower" : "followers"}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </IconCount>
  );
}

/** How many people someone follows, as a person-with-check icon and the number. */
export function FollowingCount({ count }: { count: number }) {
  return (
    <IconCount count={count} label="following">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="m16 11 2 2 4-4" />
    </IconCount>
  );
}

/** The row the profile's counts sit in, and each count's 44 px link. */
export const STAT_ROW = "-mx-2 flex flex-wrap items-center gap-x-1";
export const STAT_LINK = "press inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2";

/**
 * The cues that tell a stranger whether to trust a seller, for the line beside their @handle: stars with the review
 * count (or "New") and items sold. Plain text, not links: on a listing the whole seller card is one link to their profile.
 * Each part appears only when there is real data behind it.
 */
export function SellerStats({ rating, sold }: { rating: { average: number; count: number } | null; sold: number }) {
  return (
    <>
      {rating ? <Stars average={rating.average} count={rating.count} /> : sold === 0 ? <NewPill /> : null}
      {sold > 0 ? <SoldCount count={sold} /> : null}
    </>
  );
}
