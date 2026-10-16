"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Feed", icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/posts/new", label: "Sell", icon: "M12 5v14M5 12h14", primary: true },
  { href: "/me/posts", label: "My posts", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/me/settings", label: "Me", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0" },
] as const;

/** Fixed bottom tabs, within thumb reach. Pads for the iPhone home bar. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-[var(--background)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-zinc-800"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-4">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-0.5 text-xs ${active ? "font-semibold text-zinc-900 dark:text-zinc-50" : "text-zinc-500"}`}
              >
                <span
                  className={`flex items-center justify-center ${"primary" in tab ? "h-8 w-12 rounded-full bg-brand text-white" : "h-8 w-8"}`}
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={tab.icon} />
                  </svg>
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
