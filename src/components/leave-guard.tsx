"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmSheet } from "@/components/confirm-sheet";

/**
 * While `active`, a tap on any in-app link (the tab bar, the header) asks before leaving, so unsaved edits are not lost
 * by accident. Links that open elsewhere, modified clicks and links to the same page pass through. Browser back and
 * closing the tab are not covered here (the page's own `beforeunload` handles the tab; App Router has no safe hook for back).
 * `skipBack`: leave the header's Back arrow alone, for a page that already asks on it. `allow`: a path prefix that stays
 * inside the same edit (Edit profile's name and handle pages), so going there never asks.
 */
export function LeaveGuard({ active, skipBack = false, allow }: { active: boolean; skipBack?: boolean; allow?: string }) {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      if (skipBack && link.getAttribute("aria-label") === "Back") return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (allow && url.pathname.startsWith(allow)) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setTarget(url.pathname + url.search + url.hash);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active, skipBack, allow]);

  return (
    <ConfirmSheet
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) setTarget(null);
      }}
      title="Discard changes?"
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      danger
      onConfirm={() => {
        const href = target;
        setTarget(null);
        if (href) router.push(href);
      }}
    >
      You have changes that are not saved.
    </ConfirmSheet>
  );
}
