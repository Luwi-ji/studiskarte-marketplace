import type { ReactNode } from "react";

/**
 * Small drawing of the feed screen, in HTML so it follows light and dark mode. It shows the layout of the real screen
 * with real photos but example titles and prices; they are not real listings, people or numbers.
 */

function PhoneFrame({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`relative mx-auto aspect-[9/17] w-[15.5rem] overflow-hidden rounded-[2.4rem] border-[7px] border-zinc-900 bg-[var(--background)] text-[var(--foreground)] shadow-2xl dark:border-zinc-700 ${className}`}
    >
      <div aria-hidden className="pointer-events-none flex h-full select-none flex-col">
        <div className="mx-auto mt-1.5 h-3.5 w-16 shrink-0 rounded-full bg-zinc-900 dark:bg-zinc-700" />
        {children}
      </div>
    </div>
  );
}

const CARDS = [
  { title: "School uniform set", price: "₱600", photo: "/landing/uniform-180.webp" },
  { title: "Pre-loved clothes bundle", price: "₱350", photo: "/landing/clothes-180.webp" },
  { title: "Shoes, assorted sizes", price: "₱500", photo: "/landing/shoes-180.webp" },
  { title: "Egg sandwich", price: "₱60", photo: "/landing/sandwich-180.webp" },
];

/** The feed: tabs, then listing cards. */
export function FeedMock({ className = "" }: { className?: string }) {
  return (
    <PhoneFrame label="An example of the Studiskarte feed with Showcase and Wishlist listings" className={className}>
      <div className="flex items-center gap-1.5 px-3 pb-1 pt-2">
        <span className="h-4 w-4 rounded-md bg-brand" />
        <span className="text-[11px] font-semibold">Studiskarte</span>
      </div>
      <div className="flex gap-3 border-b border-zinc-200 px-3 text-[9px] font-medium dark:border-zinc-800">
        <span className="border-b-2 border-brand py-1.5 text-brand-text">All schools</span>
        <span className="py-1.5 text-zinc-500">Showcase</span>
        <span className="py-1.5 text-zinc-500">Wishlist</span>
      </div>
      <div className="grid grid-cols-2 gap-2 p-2.5">
        {CARDS.map((card) => (
          <div key={card.title} className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={card.photo} alt="" width={180} height={180} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              <span className="absolute left-1 top-1 rounded-full bg-brand px-1.5 py-0.5 text-[7px] font-semibold text-white">Showcase</span>
            </div>
            <div className="px-1.5 py-1.5">
              <p className="text-[10px] font-bold">{card.price}</p>
              <p className="truncate text-[8px] text-zinc-600 dark:text-zinc-400">{card.title}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-around border-t border-zinc-200 px-2 pb-3 pt-1.5 text-[7px] font-medium text-zinc-500 dark:border-zinc-800">
        <span className="text-brand-text">Feed</span>
        <span>Messages</span>
        <span className="flex h-5 w-8 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">+</span>
        <span>My posts</span>
        <span>Me</span>
      </div>
    </PhoneFrame>
  );
}

/** A real screenshot inside a phone frame. The frame takes the screenshot's own height, so nothing is cropped or stretched. */
export function ScreenPhone({ src, alt, height, className = "" }: { src: string; alt: string; height: number; className?: string }) {
  return (
    <div className={`relative w-full overflow-hidden rounded-[2.2rem] border-[6px] border-zinc-900 bg-white shadow-xl dark:border-zinc-700 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} width={450} height={height} loading="lazy" decoding="async" className="block h-auto w-full" />
    </div>
  );
}
