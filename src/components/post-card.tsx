import Link from "next/link";
import type { PostCardData } from "@/lib/discovery/cards";
import { formatPrice } from "@/lib/posts/format";

/** Two-column grid of cards, from the server or the browser. */
export function CardGrid({ cards }: { cards: PostCardData[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {cards.map((card) => {
        const wishlist = card.kind === "wishlist";
        const reserved = card.status === "reserved";
        return (
          <li key={card.id} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <Link href={`/posts/${card.id}`} className="block active:opacity-80">
              <div className="relative">
                {/* Signed, short-lived links; next/image would route private photos through the optimizer. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={card.photoUrl} alt="" className={`aspect-square w-full object-cover ${reserved ? "opacity-60" : ""}`} loading="lazy" />
                {wishlist || reserved ? (
                  <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
                    {wishlist ? <span className="rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">Wishlist</span> : null}
                    {reserved ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Reserved</span> : null}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-0.5 p-2">
                <p className="text-base font-semibold">
                  {wishlist && card.priceKind === "amount" ? "Budget " : ""}
                  {formatPrice(card.priceKind, card.priceAmount)}
                </p>
                <p className="line-clamp-2 text-sm leading-snug">{card.title}</p>
                <p className="truncate text-xs text-zinc-500">
                  {card.ownerHandle ? `@${card.ownerHandle} · ` : ""}
                  {card.listedAgo}
                </p>
                {/* The whole school name: it is the cue that tells one school from another. */}
                <p className="line-clamp-2 text-xs text-zinc-500">{card.school}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
