"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { ConfirmSheet } from "@/components/confirm-sheet";
import { canGoBackInApp } from "@/components/page-header";

/** For a form whose values can be kept as a draft: the guard then offers Save draft and leave, and Discard clears it. */
export type LeaveDraft = { onSave: () => void; onDiscard: () => void };

/**
 * While `active`, a tap on any in-app link (the tab bar, the header) asks before leaving, so unsaved edits are not lost
 * by accident. Links that open elsewhere, modified clicks and links to the same page pass through. Browser back and
 * closing the tab are not covered here (the page's own `beforeunload` handles the tab; App Router has no safe hook for back).
 * `skipBack`: leave the header's Back arrow alone, for a page that already asks on it. `allow`: a path prefix that stays
 * inside the same edit (Edit profile's name and handle pages), so going there never asks.
 * `draft`: three choices instead of two (Keep editing, Save draft and leave, Discard); each runs before going on.
 */
export function LeaveGuard({ active, skipBack = false, allow, draft }: { active: boolean; skipBack?: boolean; allow?: string; draft?: LeaveDraft }) {
  const router = useRouter();
  // `back`: the tap was on the header's Back arrow, so leaving goes back in history (as the arrow does), not forward to its address.
  const [target, setTarget] = useState<{ href: string; back: boolean } | null>(null);

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
      setTarget({ href: url.pathname + url.search + url.hash, back: link.getAttribute("aria-label") === "Back" });
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active, skipBack, allow]);

  const close = (open: boolean) => {
    if (!open) setTarget(null);
  };
  const leave = (run?: () => void) => {
    const go = target;
    setTarget(null);
    run?.();
    if (!go) return;
    if (go.back && canGoBackInApp()) router.back();
    else router.push(go.href);
  };

  if (draft) {
    const button = "press flex h-12 w-full items-center justify-center rounded-lg font-medium";
    return (
      <BottomSheet open={target !== null} onOpenChange={close} label="Leave this post?">
        <div className="flex flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
          <h2 className="text-lg font-semibold">Leave this post?</h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">Your changes are kept on this device as a draft, so you can finish later. Or discard them.</p>
          <button type="button" onClick={() => leave(draft.onSave)} className={`${button} bg-brand text-white`}>
            Save draft and leave
          </button>
          <button type="button" onClick={() => close(false)} className={`${button} border border-zinc-300 dark:border-zinc-700`}>
            Keep editing
          </button>
          <button type="button" onClick={() => leave(draft.onDiscard)} className={`${button} border border-red-700 text-red-700 dark:border-red-400 dark:text-red-400`}>
            Discard
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <ConfirmSheet open={target !== null} onOpenChange={close} title="Discard changes?" confirmLabel="Discard" cancelLabel="Keep editing" danger onConfirm={() => leave()}>
      You have changes that are not saved.
    </ConfirmSheet>
  );
}
