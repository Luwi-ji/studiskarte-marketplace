"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { markReadAction, sendMessageAction } from "../actions";
import Link from "next/link";
import { offerLabels, type OfferOptions } from "@/lib/deals/rules";
import { Composer } from "../composer";
import { OfferCardView, type OfferCardData } from "./offer-card";

export type ChatPictureData = { url: string; thumbUrl: string; width: number; height: number };
export type ChatMessageData = { id: number; mine: boolean; body: string | null; createdAt: string; pictures: ChatPictureData[]; offer: OfferCardData | null };

// New messages appear within this many seconds while the conversation is open.
const REFRESH_SECONDS = 5;
// Within this many pixels of the bottom counts as reading the newest messages.
const AT_BOTTOM_PX = 120;

function scrollToBottom() {
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
}

/** The shape of a picture before it loads, so nothing moves when it does. */
function pictureRatio(p: ChatPictureData): number {
  return Math.min(1.6, Math.max(0.75, p.width / p.height));
}

const timeFormat = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
const dayFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

/**
 * The thread and the message box. The page refreshes itself every few seconds
 * while it is showing, so the other person's replies appear without a reload,
 * and anything they sent is marked read.
 */
export function Chat({
  conversationId,
  messages,
  unread,
  readOnlyReason,
  postId,
  postKind,
  viewerIsOwner,
  otherName,
  offerOptions,
}: {
  conversationId: string;
  messages: ChatMessageData[];
  unread: number;
  readOnlyReason: string | null;
  postId: string;
  postKind: string;
  viewerIsOwner: boolean;
  otherName: string;
  offerOptions: OfferOptions;
}) {
  const router = useRouter();
  const viewer = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState<ChatPictureData | null>(null);
  const lastId = messages.at(-1)?.id;
  const lastMine = messages.at(-1)?.mine ?? false;
  // The responder can offer or reserve when the post takes offers and they have none waiting.
  const hasPendingOffer = messages.some((m) => m.offer?.status === "pending");
  const labels = offerLabels(postKind);
  const canOffer = !viewerIsOwner && !hasPendingOffer && (offerOptions.offer || offerOptions.reserve);
  // Following the newest message: true while the reader is at the bottom.
  const following = useRef(true);
  const newest = useRef(lastId);
  // The newest message the reader has scrolled down to.
  const [seenId, setSeenId] = useState(lastId);
  const behind = lastId !== undefined && seenId !== lastId && !lastMine;

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [router]);

  // Track whether the reader is at the bottom.
  useEffect(() => {
    function onScroll() {
      const gap = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
      following.current = gap < AT_BOTTOM_PX;
      if (following.current) setSeenId(newest.current);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Open at the newest message, and stay with it as messages arrive. A reader
  // who scrolled up to older messages is left where they are; your own
  // message always brings you down.
  useEffect(() => {
    newest.current = lastId;
    if (following.current || lastMine) scrollToBottom();
  }, [lastId, lastMine]);

  // Messages from the other person that are on screen are read.
  useEffect(() => {
    if (unread > 0) void markReadAction(conversationId).catch(() => {});
  }, [conversationId, lastId, unread]);

  function open(picture: ChatPictureData) {
    setShown(picture);
    viewer.current?.showModal();
  }

  // A date line above the first message of each day.
  const days = messages.map((m) => dayFormat.format(new Date(m.createdAt)));
  return (
    <>
      <ul className="flex flex-1 flex-col gap-1.5 px-3 py-3" aria-label="Messages">
        {messages.map((m, index) => {
          const when = new Date(m.createdAt);
          const day = days[index];
          const divider = index === 0 || day !== days[index - 1];
          return (
            <li key={m.id} className="flex flex-col gap-1.5">
              {divider ? <p className="py-1 text-center text-xs text-zinc-500">{day}</p> : null}
              <div className={`flex flex-col gap-1 ${m.mine ? "items-end" : "items-start"}`}>
                {m.pictures.length > 0 ? (
                  <div className={`grid w-[80%] gap-1 ${m.pictures.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {m.pictures.map((p) => (
                      <button
                        key={p.url}
                        type="button"
                        onClick={() => open(p)}
                        aria-label="View picture full screen"
                        style={{ aspectRatio: m.pictures.length > 1 ? 1 : pictureRatio(p) }}
                        className="block overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.thumbUrl} alt="Picture in the conversation" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                ) : null}
                {m.offer ? (
                  <OfferCardView offer={m.offer} viewerIsOwner={viewerIsOwner} responderName={otherName} postKind={postKind} />
                ) : null}
                {m.body ? (
                  <p className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 ${m.mine ? "bg-brand text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}>{m.body}</p>
                ) : null}
                <span className="px-1 text-[11px] text-zinc-500">{timeFormat.format(when)}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 z-10 border-t border-zinc-200 bg-[var(--background)] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 dark:border-zinc-800">
        {behind ? (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute -top-14 right-3 flex h-11 items-center rounded-full bg-brand px-4 text-sm font-medium text-white shadow-lg"
          >
            New message ↓
          </button>
        ) : null}
        {canOffer && !readOnlyReason ? (
          <div className="mb-2 flex gap-2">
            {offerOptions.offer ? (
              <Link href={`/offers/new?post=${postId}&type=offer`} className="flex h-11 flex-1 items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700">
                {labels.offer}
              </Link>
            ) : null}
            {offerOptions.reserve ? (
              <Link href={`/offers/new?post=${postId}&type=reserve`} className="flex h-11 flex-1 items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700">
                {labels.reserve}
              </Link>
            ) : null}
          </div>
        ) : null}
        {readOnlyReason ? (
          <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">{readOnlyReason}</p>
        ) : (
          <Composer onSend={(input) => sendMessageAction(conversationId, input)} />
        )}
      </div>

      <dialog
        ref={viewer}
        onClose={() => setShown(null)}
        aria-label="Picture"
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
      >
        <div className="relative flex h-full w-full items-center justify-center">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown.url} alt="Picture in the conversation" className="max-h-full max-w-full object-contain" />
          ) : null}
          <button
            type="button"
            onClick={() => viewer.current?.close()}
            aria-label="Close"
            className="absolute right-2 top-[calc(0.5rem+env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-2xl"
          >
            ×
          </button>
        </div>
      </dialog>
    </>
  );
}
