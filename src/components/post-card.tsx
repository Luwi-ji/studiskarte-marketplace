import Link from "next/link";
import { CardHeart } from "@/components/card-heart";
import type { PostCardData } from "@/lib/discovery/cards";
import { formatPrice, kindLabel } from "@/lib/posts/format";

const pill = "whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-semibold min-[360px]:px-2 min-[360px]:text-xs";

/** Each kind has its own accent colour: the kind badge and the price. The card itself stays plain. */
const ACCENT: Record<string, { badge: string; price: string }> = {
  wishlist: { badge: "bg-amber-400 text-amber-950", price: "text-amber-700 dark:text-amber-300" },
};
const SHOWCASE_ACCENT = { badge: "bg-brand text-white", price: "text-brand-text" };

/**
 * Two-column grid of cards, from the server or the browser. The card is one tappable area: the title's link is
 * stretched over it, and the heart is lifted above that link so a tap on it does not open the post.
 */
export function CardGrid({ cards }: { cards: PostCardData[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <li key={card.id} className="min-w-0">
          <Card card={card} />
        </li>
      ))}
    </ul>
  );
}

/** One card; also used on its own in the swipe rows under a listing. */
export function Card({ card }: { card: PostCardData }) {
  const reserved = card.status === "reserved";
  const accent = ACCENT[card.kind] ?? SHOWCASE_ACCENT;
  return (
    <div className="press relative flex h-full flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm has-[button:active]:scale-100 has-[button:active]:opacity-100 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative">
        {/* Signed, short-lived links; next/image would route private photos through the optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.photoUrl} alt="" className={`aspect-square w-full object-cover ${reserved ? "opacity-60" : ""}`} loading="lazy" />
        <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
          <span className={`${pill} ${accent.badge}`}>{kindLabel(card.kind)}</span>
          {reserved ? <span className={`${pill} bg-amber-100 text-amber-900`}>Reserved</span> : null}
        </div>
        <span className={`${pill} absolute right-1.5 top-1.5 bg-black/70 text-white`}>{card.listedAgo}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-3 pb-3 pt-2">
        <div className="flex items-center justify-between gap-1">
          {/* A wishlist amount is a budget: the Wishlist badge on the photo says so, which keeps the price whole at 320px. */}
          <p className={`min-w-0 truncate text-lg font-bold ${accent.price}`}>{formatPrice(card.priceKind, card.priceAmount)}</p>
          <CardHeart postId={card.id} initial={card.hearted} />
        </div>
        <Link href={`/posts/${card.id}`} className="line-clamp-2 text-sm font-medium leading-snug after:absolute after:inset-0">
          {card.title}
        </Link>
        <p className="mt-auto flex min-w-0 items-center gap-1 pt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {card.ownerHandle ? <span className="min-w-0 truncate">@{card.ownerHandle}</span> : null}
          {card.ownerHandle ? <span aria-hidden>·</span> : null}
          <span className="shrink-0 font-medium text-zinc-700 dark:text-zinc-300" aria-hidden>
            {card.schoolShort}
          </span>
          <span className="sr-only">{card.school}</span>
        </p>
      </div>
    </div>
  );
}
