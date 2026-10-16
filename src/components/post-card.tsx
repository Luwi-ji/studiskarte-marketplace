import Link from "next/link";
import type { PostCardData } from "@/lib/discovery/cards";
import { formatPrice, kindLabel } from "@/lib/posts/format";

/** Two-column grid of cards, from the server or the browser. */
export function CardGrid({ cards }: { cards: PostCardData[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {cards.map((card) => (
        <li key={card.id} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <Link href={`/posts/${card.id}`} className="block active:opacity-80">
            {/* Signed, short-lived links; next/image would route private photos through the optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.photoUrl} alt="" className="aspect-square w-full object-cover" loading="lazy" />
            <div className="flex flex-col gap-0.5 p-2">
              <p className="text-base font-semibold">{formatPrice(card.priceKind, card.priceAmount)}</p>
              <p className="line-clamp-2 text-sm leading-snug">{card.title}</p>
              <p className="truncate text-xs text-zinc-500">
                {kindLabel(card.kind)}
                {card.ownerHandle ? ` · @${card.ownerHandle}` : ""}
              </p>
              <p className="truncate text-xs text-zinc-500">{card.school}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
