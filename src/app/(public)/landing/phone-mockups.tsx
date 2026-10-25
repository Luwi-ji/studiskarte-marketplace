import type { ReactNode } from "react";

/**
 * Small drawings of two app screens, in HTML so they cost no image download and follow light and dark mode.
 * They show the layout of the real screens with example text; they are not real listings, people or numbers.
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
  { title: "Calculus textbook", price: "₱450", kind: "Showcase", tint: "bg-brand/25" },
  { title: "Scientific calculator", price: "₱500", kind: "Wishlist", tint: "bg-amber-300/40" },
  { title: "Org shirt, size M", price: "₱200", kind: "Showcase", tint: "bg-emerald-400/30" },
  { title: "Free study notes", price: "Free", kind: "Showcase", tint: "bg-fuchsia-400/25" },
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
            <div className={`relative aspect-square ${card.tint}`}>
              <span className={`absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${card.kind === "Wishlist" ? "bg-amber-100 text-amber-900" : "bg-brand text-white"}`}>{card.kind}</span>
            </div>
            <div className="px-1.5 py-1.5">
              <p className="text-[10px] font-bold">{card.price}</p>
              <p className="truncate text-[8px] text-zinc-600 dark:text-zinc-400">{card.title}</p>
            </div>
          </div>
        ))}
      </div>
    </PhoneFrame>
  );
}
