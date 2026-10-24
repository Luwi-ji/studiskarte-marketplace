import Link from "next/link";
import type { ShowcaseStanding } from "@/lib/posts/showcase-limit";

const COPY = {
  free: {
    title: "One showcase until your first sale",
    body: "Without an ID check you can have 1 open showcase. After your first sale is complete you need an ID check to post more showcases or answer Wishlists. Posting your own Wishlist is not affected.",
    cta: "About the ID check",
    tone: "neutral",
  },
  limit: {
    title: "You already have an open showcase",
    body: "Finish selling it, or withdraw it if nothing sold, to post another. An ID check lifts this limit.",
    cta: "Check my ID",
    tone: "warn",
  },
  sold: {
    title: "Your first sale is complete",
    body: "To sell more, post showcases or answer Wishlists, check your ID. Your listings and deals in progress carry on as normal, and you can still post your own Wishlists.",
    cta: "Check my ID",
    tone: "warn",
  },
} as const;

/** What an unverified student needs to know about showcases and the ID check, and what to do. Nothing for anyone else. */
export function IdCheckReminder({ standing, className = "" }: { standing: ShowcaseStanding; className?: string }) {
  if (standing === "off" || standing === "checked") return null;
  const copy = COPY[standing];
  const tone =
    copy.tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
      : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900";
  return (
    <section aria-label="ID check reminder" className={`flex flex-col gap-2 rounded-lg border p-3 ${tone} ${className}`}>
      <p className="text-sm font-medium">{copy.title}</p>
      <p className="text-sm">{copy.body}</p>
      <Link href="/me/verify" className="press flex h-11 items-center justify-center self-start rounded-lg border border-current px-4 text-sm font-medium">
        {copy.cta}
      </Link>
    </section>
  );
}
