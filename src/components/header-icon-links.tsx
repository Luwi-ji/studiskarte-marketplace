"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type MouseEvent } from "react";

/**
 * Whether the link's page is open, and whether the link was just tapped and its page is still on its way. A tap shows
 * at once (the page may take a moment) and clears when the address changes, so coming back never shows a stale tap.
 */
function useLinkOn(href: string) {
  const pathname = usePathname();
  const [tappedAt, setTappedAt] = useState<string | null>(null);
  if (tappedAt !== null && pathname !== tappedAt) setTappedAt(null);
  const current = pathname === href || pathname.startsWith(`${href}/`);

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    // A new-tab click stays on this page and has nothing to wait for.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setTappedAt(pathname);
  }
  return { current, on: current || tappedAt !== null, onClick };
}

const iconLink = "press group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full";

/** The heart outline; filled and red when `filled`. The one heart of the Hearted page, in the header link and in its title. */
export function HeartIcon({ filled = false, className = "h-6 w-6" }: { filled?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} ${filled ? "heart-pop fill-red-500 stroke-red-500" : "fill-none stroke-current"}`}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z" />
    </svg>
  );
}

/** The Hearted page's title: the red filled heart, then the words. */
export function HeartedTitle() {
  return (
    <span className="flex items-center gap-2">
      <HeartIcon filled className="h-5 w-5 shrink-0" />
      <span className="truncate">Hearted posts</span>
    </span>
  );
}

/** The heart in the feed header: fills red the moment it is pressed and while the Hearted page is open. */
export function HeartLink() {
  const { current, on, onClick } = useLinkOn("/me/hearts");
  return (
    <Link href="/me/hearts" aria-label="Hearted posts" aria-current={current ? "page" : undefined} onClick={onClick} className={iconLink}>
      {on ? (
        <HeartIcon filled />
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 fill-none stroke-current transition-[fill,stroke] duration-100 ease-out group-active:fill-red-500 group-active:stroke-red-500 motion-reduce:transition-none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10z" />
        </svg>
      )}
    </Link>
  );
}

/** The bell in the feed header: fills with the brand colour on press and while Notifications is open; the unread count sits on it. */
export function BellLink({ unread }: { unread: number }) {
  const { current, on, onClick } = useLinkOn("/notifications");
  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      aria-current={current ? "page" : undefined}
      onClick={onClick}
      className={`${iconLink} transition-colors duration-100 ease-out motion-reduce:transition-none active:text-brand-text ${on ? "text-brand-text" : ""}`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-6 w-6 stroke-current ${on ? "fill-current" : "fill-none group-active:fill-current"}`}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 9a6 6 0 1 1 12 0c0 6 2 7 2 7H4s2-1 2-7zM10 20a2 2 0 0 0 4 0" />
      </svg>
      {unread > 0 ? (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
