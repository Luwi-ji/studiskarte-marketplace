"use client";

import { useEffect, useRef, useState } from "react";

const TOAST_MS = 9000;
const STICKER_HINT = "In a story, add a Link sticker and paste it so people can tap through.";

/** The address that goes with the picture: the public preview, not the members-only listing page. */
function linkTo(postId: string): string {
  return `${window.location.origin}/s/${postId}`;
}

/**
 * Shares a listing as a story card (a 1080 x 1920 picture made by the share-card route). Phones open
 * their share sheet, which offers Instagram and Facebook Stories and Messages; where files cannot be
 * shared (most desktops) the picture is saved instead. The picture holds no name or contact detail. The link
 * that goes with it is the public preview (/s/<id>), which unfolds into a card in chats and posts.
 */
export function ShareButton({ postId, title }: { postId: string; title: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; copyButton?: boolean } | null>(null);
  // The picture, once made: a browser may refuse a share that comes seconds after the tap, so the next tap shares at once.
  const card = useRef<File | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [message]);

  /** Puts the listing's link on the clipboard; false when the browser refuses. */
  async function copyLink(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(linkTo(postId));
      return true;
    } catch {
      return false;
    }
  }

  async function copyAgain() {
    setMessage((await copyLink()) ? { text: `Link copied. ${STICKER_HINT}` } : { text: "Could not copy the link." });
  }

  async function makeCard(): Promise<File> {
    const response = await fetch(`/posts/${postId}/share-card`, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`share card answered ${response.status}`);
    return new File([await response.blob()], `studiskarte-${postId.slice(0, 8)}.png`, { type: "image/png" });
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

  async function share() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    // The picture itself cannot be tapped, so the listing's link travels with it (in the share and on the clipboard,
    // for a link sticker in a story). It is the public preview, which unfolds into a card in chats and posts and takes
    // people into the app. Copied now, while the tap still counts as a user action.
    const copied = await copyLink();
    try {
      let file = card.current;
      if (!file) {
        try {
          file = await makeCard();
        } catch {
          setMessage({ text: "Could not make the share card. Try again." });
          return;
        }
        card.current = file;
      }
      const data = { files: [file], title, text: `${title} on Studiskarte Marketplace`, url: linkTo(postId) };
      if (typeof navigator.canShare !== "function" || !navigator.canShare(data)) {
        save(file);
        setMessage(copied ? { text: `Card saved and link copied. ${STICKER_HINT}` } : { text: "Card saved to your device.", copyButton: true });
        return;
      }
      try {
        await navigator.share(data);
        setMessage(copied ? { text: `Link copied. ${STICKER_HINT}` } : { text: "Shared.", copyButton: true });
      } catch (error) {
        if (!(error instanceof DOMException)) throw error;
        // Closing the share sheet is not an error.
        if (error.name === "AbortError") return;
        if (error.name === "NotAllowedError") {
          setMessage({ text: "Your card is ready. Tap share again to send it." });
          return;
        }
        throw error;
      }
    } catch {
      setMessage({ text: "Could not share the card. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={share}
        aria-label="Share this listing"
        aria-busy={busy}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/50 text-white ${busy ? "opacity-60" : ""}`}
      >
        {busy ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6 animate-spin motion-reduce:animate-none" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <path d="M12 3a9 9 0 1 1-9 9" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 15V3" />
            <path d="M7.5 7.5 12 3l4.5 4.5" />
            <path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" />
          </svg>
        )}
      </button>
      {message ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-sm flex-col items-center gap-1 rounded-lg bg-zinc-900 px-4 py-3 text-center text-sm text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900"
        >
          <p>{message.text}</p>
          {message.copyButton ? (
            <button type="button" onClick={copyAgain} className="inline-flex min-h-11 items-center px-3 font-semibold underline">
              Copy link
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
