"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const TABS = [
  { href: "/", label: "Feed", icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/messages", label: "Messages", icon: "M4 5h16v11H9l-5 4z" },
  { href: "/posts/new", label: "Create", icon: "M12 5v14M5 12h14", primary: true },
  { href: "/perks", label: "Perks", icon: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01" },
  { href: "/me/settings", label: "Me", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0" },
] as const;

// Scrolling down past this far from the top hides the bar; any upward scroll shows it.
const HIDE_AFTER_PX = 120;
const MOVE_PX = 8;

/**
 * Fixed bottom tabs, within thumb reach. Pads for the iPhone home bar. Slides
 * away while scrolling down to give the content room, and comes back on the
 * first scroll up, at the top, at the bottom, and on every page change.
 */
export function BottomNav({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      const nearBottom = y + window.innerHeight >= document.documentElement.scrollHeight - 8;
      if (y <= HIDE_AFTER_PX || nearBottom || y < lastY.current - MOVE_PX) setHidden(false);
      else if (y > lastY.current + MOVE_PX) setHidden(true);
      if (Math.abs(y - lastY.current) > MOVE_PX) lastY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Show the bar again on every page change.
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setHidden(false);
  }

  return (
    <nav
      aria-label="Main"
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-[var(--background)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur motion-safe:transition-transform motion-safe:duration-200 dark:border-zinc-800 ${hidden ? "translate-y-full" : ""}`}
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                tabIndex={hidden ? -1 : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-xs ${active ? "font-semibold text-zinc-900 dark:text-zinc-50" : "text-zinc-500"}`}
              >
                <span
                  className={`relative flex items-center justify-center ${"primary" in tab ? "h-8 w-12 rounded-full bg-brand text-white" : "h-8 w-8"}`}
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
