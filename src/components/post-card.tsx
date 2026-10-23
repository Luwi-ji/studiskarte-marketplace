import Link from "next/link";
import { CardHeart } from "@/components/card-heart";
import type { PostCardData } from "@/lib/discovery/cards";
import { formatPrice, kindLabel } from "@/lib/posts/format";

const pill = "rounded-full px-1.5 py-0.5 text-[11px] font-medium min-[360px]:px-2 min-[360px]:text-xs";

/**
 * Two-column grid of cards, from the server or the browser. The card is one tappable area: the title's link is
 * stretched over it, and the heart is lifted above that link so a tap on it does not open the post.
 */
export function CardGrid({ cards }: { cards: PostCardData[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {cards.map((card) => {
        const reserved = card.status === "reserved";
        return (
          <li
            key={card.id}
            className="press relative flex flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white has-[button:active]:scale-100 has-[button:active]:opacity-100 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="relative">
              {/* Signed, short-lived links; next/image would route private photos through the optimizer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.photoUrl} alt="" className={`aspect-square w-full object-cover ${reserved ? "opacity-60" : ""}`} loading="lazy" />
              <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
                <span className={`${pill} max-w-[60%] truncate bg-black/70 text-white`}>{kindLabel(card.kind)}</span>
                {reserved ? <span className={`${pill} bg-amber-100 text-amber-900`}>Reserved</span> : null}
              </div>
              <span className={`${pill} absolute right-1.5 top-1.5 bg-black/70 text-white`}>{card.listedAgo}</span>
            </div>
            <div className="flex flex-col gap-1.5 px-3 pb-3 pt-3">
              <div className="flex items-center">
                <CardHeart postId={card.id} initial={card.hearted} />
                <p className="min-w-0 truncate pl-1 text-base font-semibold">
                  {/* A wishlist amount is a budget: the Wishlist badge on the photo says so, which keeps the price whole at 320px. */}
                  {formatPrice(card.priceKind, card.priceAmount)}
                </p>
              </div>
              <Link href={`/posts/${card.id}`} className="line-clamp-2 text-sm leading-snug after:absolute after:inset-0">
                {card.title}
              </Link>
              <p className="flex min-w-0 items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                <span className={`font-medium ${card.meetupLocation ? "max-w-[50%] shrink-0 truncate" : "truncate"}`} aria-hidden>
                  {card.schoolShort}
                </span>
                <span className="sr-only">{card.school}</span>
                {card.meetupLocation ? (
                  <>
                    <svg viewBox="0 0 24 24" className="ml-1 h-3.5 w-3.5 shrink-0 fill-none stroke-current" strokeWidth="2" aria-hidden>
                      <path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                    <span className="truncate">{card.meetupLocation}</span>
                  </>
                ) : null}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
