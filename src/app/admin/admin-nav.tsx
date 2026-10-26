"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/posts", label: "Posts" },
  { href: "/admin/verifications", label: "ID checks" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/schools", label: "Schools" },
  { href: "/admin/perks", label: "Perks" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/system", label: "System" },
  { href: "/admin/security", label: "Security" },
] as const;

/** The admin area's tabs. They scroll sideways on a very narrow phone. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-2 pb-2">
      {TABS.map((tab) => {
        const active = tab.href === "/admin" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-9 shrink-0 items-center rounded-full border px-4 text-sm ${active ? "border-transparent bg-brand font-medium text-white" : "border-zinc-300 dark:border-zinc-700"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
