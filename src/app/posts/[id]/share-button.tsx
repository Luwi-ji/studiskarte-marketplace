"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/bottom-sheet";

const TOAST_MS = 6000;
const SHARE_BUTTON = "share-sheet-button";
const STORY_HELP = "Stories cannot make a picture clickable. Add the link as a Link sticker (Instagram) or link button, then paste it.";

/** The address that goes with a listing: the public preview, not the members-only listing page. Only ever shared bare, never with a title. */
function linkTo(postId: string): string {
  return `${window.location.origin}/s/${postId}`;
}

/** Can this browser hand a picture to the share sheet? Asked with a stand-in file, because the real one is made later. */
function canShareFiles(): boolean {
  if (typeof navigator.canShare !== "function" || typeof navigator.share !== "function") return false;
  try {
    return navigator.canShare({ files: [new File([], "card.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

function Row({ icon, hint, busy, onClick, children }: { icon: string; hint?: string; busy?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-busy={busy}
        className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-zinc-100 disabled:opacity-60 dark:active:bg-zinc-800"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={icon} />
        </svg>
        <span className="min-w-0 flex-1">
          <span className="block">{children}</span>
          {hint ? <span className="block text-sm text-zinc-500">{hint}</span> : null}
        </span>
      </button>
    </li>
  );
}

const ICON_SHARE = "M12 15V3M7.5 7.5L12 3l4.5 4.5M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12";
const ICON_LINK = "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1";
const ICON_IMAGE = "M4 5h16v14H4V5zM4 16l5-5 4 4 3-3 4 4M9 9h.01";

/**
 * Opens a sheet with three ways to share a listing. Everything that carries the link carries the bare public
 * address (/s/<id>) and nothing else: a title next to it makes chat apps paste plain text instead of a link. The
 * address unfolds into a clickable card in chats from the page's Open Graph tags. A story picture (a 1080 x 1920
 * image from the share-card route, with no name or contact detail) cannot be made clickable, so that row also
 * copies the link for a link sticker.
 */
export function ShareButton({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [canShareLink, setCanShareLink] = useState(false);
  const [canShareCard, setCanShareCard] = useState(false);
  // The picture, once made: a browser may refuse a share that comes seconds after the tap, so it is made as the sheet opens.
  const card = useRef<File | null>(null);
  const making = useRef<Promise<File> | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [message]);

  function makeCard(): Promise<File> {
    if (card.current) return Promise.resolve(card.current);
    making.current ??= (async () => {
      try {
        const response = await fetch(`/posts/${postId}/share-card`, { credentials: "same-origin" });
        if (!response.ok) throw new Error(`share card answered ${response.status}`);
        const file = new File([await response.blob()], `studiskarte-${postId.slice(0, 8)}.png`, { type: "image/png" });
        card.current = file;
        return file;
      } finally {
        making.current = null;
      }
    })();
    return making.current;
  }

  function onOpenChange(next: boolean) {
    if (next) {
      // Asked when the sheet opens, in the browser: the server cannot know what the phone can share.
      setCanShareLink(typeof navigator.share === "function");
      setCanShareCard(canShareFiles());
      if (!card.current) makeCard().catch(() => {});
    }
    setOpen(next);
  }

  /** Puts the bare link on the clipboard; false when the browser refuses. */
  async function copyLink(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(linkTo(postId));
      return true;
    } catch {
      return false;
    }
  }

  function save(file: File) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function copy() {
    setOpen(false);
    setMessage((await copyLink()) ? "Link copied" : "Could not copy the link.");
  }

  async function shareLink() {
    setOpen(false);
    try {
      await navigator.share({ url: linkTo(postId) });
    } catch (error) {
      // Closing the share sheet is not an error.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage((await copyLink()) ? "Link copied" : "Could not share the link.");
    }
  }

  async function shareToStory() {
    if (busy) return;
    setBusy(true);
    // Copied first, while the tap still counts as a user action: the link goes into a story as a sticker.
    const copied = await copyLink();
    try {
      let file: File;
      try {
        file = await makeCard();
      } catch {
        setOpen(false);
        setMessage(copied ? "Link copied. Could not make the image. Try again." : "Could not make the image. Try again.");
        return;
      }
      const data = { files: [file] };
      if (typeof navigator.canShare !== "function" || typeof navigator.share !== "function" || !navigator.canShare(data)) {
        save(file);
        setOpen(false);
        setMessage(copied ? "Image saved and link copied" : "Image saved");
        return;
      }
      try {
        await navigator.share(data);
        setOpen(false);
        setMessage(copied ? "Link copied" : null);
      } catch (error) {
        setOpen(false);
        if (!(error instanceof DOMException)) throw error;
        // Closing the share sheet is not an error.
        if (error.name === "AbortError") return;
        setMessage(error.name === "NotAllowedError" ? "Open Share and try again." : "Could not share the image. Try again.");
      }
    } catch {
      setOpen(false);
      setMessage("Could not share the image. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label="Share this listing"
        aria-haspopup="dialog"
        className={`${SHARE_BUTTON} flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/50 text-white`}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 15V3" />
          <path d="M7.5 7.5 12 3l4.5 4.5" />
          <path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" />
        </svg>
      </button>
      <BottomSheet open={open} onOpenChange={onOpenChange} label="Share this listing" returnFocusTo={`.${SHARE_BUTTON}`}>
        <div data-sheet-drag className="flex min-h-12 shrink-0 items-center gap-1 px-2">
          <span className="w-2" />
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">Share this listing</h2>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Close" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {canShareLink ? (
            <Row icon={ICON_SHARE} hint="Best for messages. It opens as a tappable preview card." onClick={shareLink}>
              Share link
            </Row>
          ) : null}
          <Row icon={ICON_LINK} onClick={copy}>
            Copy link
          </Row>
          <Row icon={ICON_IMAGE} busy={busy} onClick={shareToStory}>
            {canShareCard ? "Share to a story" : "Save image for a story"}
          </Row>
        </ul>
        <p className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 text-sm text-zinc-500">{STORY_HELP}</p>
      </BottomSheet>
      {message ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[90] mx-auto flex max-w-sm flex-col items-center gap-1 rounded-lg bg-zinc-900 px-4 py-3 text-center text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
        >
          <p>{message}</p>
        </div>
      ) : null}
    </>
  );
}
