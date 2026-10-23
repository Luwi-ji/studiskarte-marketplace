"use client";

import Link, { useLinkStatus } from "next/link";

function Label() {
  const { pending } = useLinkStatus();
  return <>{pending ? "Loading…" : "Show more"}</>;
}

/** The button under a long list. The list grows in place (same scroll position); the label says Loading… while the next people arrive. */
export function ShowMore({ href }: { href: string }) {
  return (
    <Link href={href} replace scroll={false} prefetch={false} className="press flex h-11 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700">
      <Label />
    </Link>
  );
}
