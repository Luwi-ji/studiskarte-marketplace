"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useScrollDirection } from "@/components/use-scroll-direction";

type Tab = { href: string; label: string; icon: string; primary?: boolean };

const FEED: Tab = { href: "/", label: "Feed", icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" };
const MESSAGES: Tab = { href: "/messages", label: "Messages", icon: "M4 5h16v11H9l-5 4z" };
const CREATE: Tab = { href: "/posts/new", label: "Create", icon: "M12 5v14M5 12h14", primary: true };
const PERKS: Tab = { href: "/perks", label: "Perks", icon: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" };
const MY_POSTS: Tab = { href: "/me/posts", label: "My posts", icon: "M4 4h16v16H4zM4 9h16M9 9v11" };
const ME: Tab = { href: "/me", label: "Me", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0" };

/** True when `pathname` is `base` or inside it, so "/me" does not match "/messages". */
function within(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** The Me tab covers /me/..., your own profile and its sub-pages; My posts covers /me/posts when it has its own tab. */
function isActive(tab: Tab, pathname: string, handle: string | null, hasPerks: boolean): boolean {
  if (tab.href === "/") return pathname === "/";
  if (tab.href !== ME.href) return within(pathname, tab.href);
  if (within(pathname, MY_POSTS.href)) return hasPerks;
  return within(pathname, "/me") || (handle !== null && within(pathname.toLowerCase(), `/u/${handle.toLowerCase()}`));
}

/**
 * Fixed bottom tabs, within thumb reach. Pads for the iPhone home bar. Slides
 * away while scrolling down to give the content room, and comes back on the
 * first scroll up, at the top, and on every page change (see `useScrollDirection`).
 * While hidden it marks the page (`data-tab-bar-hidden`) so the floating category bar can follow it down.
 */
export function BottomNav({ unread = 0, hasPerks = false, handle = null }: { unread?: number; hasPerks?: boolean; handle?: string | null }) {
  const tabs = hasPerks ? [FEED, MESSAGES, CREATE, PERKS, ME] : [FEED, MESSAGES, CREATE, MY_POSTS, ME];
  const pathname = usePathname();
  const { hidden, focusProps } = useScrollDirection();

  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-tab-bar-hidden", hidden);
    return () => root.removeAttribute("data-tab-bar-hidden");
  }, [hidden]);

  return (
    <nav
      aria-label="Main"
      inert={hidden}
      aria-hidden={hidden || undefined}
      {...focusProps}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-[var(--background)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur will-change-transform motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out dark:border-zinc-800 ${hidden ? "translate-y-full" : ""}`}
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {tabs.map((tab) => {
          const active = isActive(tab, pathname, handle, hasPerks);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-xs ${active ? "font-semibold text-zinc-900 dark:text-zinc-50" : "text-zinc-500"}`}
              >
                <span
                  className={`relative flex items-center justify-center ${tab.primary ? "h-8 w-12 rounded-full bg-brand text-white" : "h-8 w-8"}`}
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={tab.icon} />
                  </svg>
                  {tab.href === "/messages" && unread > 0 ? (
                    <span aria-label={`${unread} unread messages`} className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
