"use client";

import { PendingTabLink } from "@/components/pending-nav";
import { tabOff, tabOn } from "@/app/(tabs)/me/posts/strip-styles";

export type ProfileTab = { id: string; label: string; count: number; href: string };

/**
 * Showcase and Wishlist, styled like the feed's tab strip (the same classes). A tap moves the underline at once through
 * the page's `PendingNav`; the list below shows its skeleton if the other tab is slow.
 */
export function ProfileTabs({ tabs, current }: { tabs: ProfileTab[]; current: string }) {
  return (
    <nav aria-label="Listings" className="flex border-b border-zinc-200 dark:border-zinc-800">
      {tabs.map((tab) => (
        <PendingTabLink key={tab.id} id={tab.id} href={tab.href} replace current={tab.id === current} onClass={`flex-1 ${tabOn}`} offClass={`flex-1 ${tabOff}`}>
          {tab.label}
          <span className="font-normal opacity-70">{tab.count}</span>
        </PendingTabLink>
      ))}
    </nav>
  );
}
