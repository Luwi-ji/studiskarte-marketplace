import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { getConversation, type OfferCard } from "@/lib/messaging/read";
import { REPLY_LABEL } from "@/lib/messaging/response-time";
import { BlockButton } from "@/app/safety/block-button";
import { ReportControl } from "@/app/safety/report-control";
import { Chat, type ChatMessageData } from "./chat";
import type { OfferCardData } from "./offer-card";
import { ErrorBanner } from "./error-banner";
import { Transactions, type ListingCardData } from "./transactions";

export const metadata = { title: "Messages · Studiskarte Marketplace" };

const PICTURE_LINK_SECONDS = 30 * 60;

export default function ConversationPage({ params }: PageProps<"/messages/[id]">) {
  return (
    <Suspense fallback={<PageHeader title="Messages" back="/messages" />}>
      <Conversation params={params} />
    </Suspense>
  );
}

async function Conversation({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveStudent();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const view = await getConversation(me.id, id.data);
  if (!view) notFound();

  const store = getObjectStore();
  // Every listing in the thread has its picture link made once, for the bar, the cards and the offers.
  const thumbUrls = new Map(
    await Promise.all(view.listings.map(async (l): Promise<[string, string]> => [l.post.id, await store.signedUrl(l.post.thumbKey, PICTURE_LINK_SECONDS)])),
  );
  const withThumb = (l: { post: ListingCardData["post"]; viewerIsOwner: boolean; state: string | null }): ListingCardData => ({
    ...l,
    thumbUrl: thumbUrls.get(l.post.id) ?? "",
  });
  /** An offer (and its reservation) as the browser gets it: times as text, the listing with its picture link. */
  const offerData = (o: OfferCard): OfferCardData => ({
    ...o,
    expiresAt: o.expiresAt.toISOString(),
    deal: o.deal
      ? {
          ...o.deal,
          activityAt: o.deal.activityAt.toISOString(),
          handover: o.deal.handover ? { ...o.deal.handover, at: o.deal.handover.at.toISOString() } : null,
          proposal: o.deal.proposal ? { ...o.deal.proposal, at: o.deal.proposal.at.toISOString() } : null,
        }
      : null,
    listing: { post: o.post, thumbUrl: thumbUrls.get(o.post.id) ?? "" },
  });
  const messages = await Promise.all(
    view.messages.map(
      async (m): Promise<ChatMessageData> => ({
        id: m.id,
        mine: m.mine,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        listing: m.listing ? withThumb(m.listing) : null,
        offer: m.offer ? offerData(m.offer) : null,
        pictures: await Promise.all(
          m.pictures.map(async (p) => ({
            url: await store.signedUrl(p.key, PICTURE_LINK_SECONDS),
            thumbUrl: await store.signedUrl(p.thumbKey, PICTURE_LINK_SECONDS),
            width: p.width,
            height: p.height,
          })),
        ),
      }),
    ),
  );
  const name = view.other.displayName || (view.other.handle ? `@${view.other.handle}` : "Student");

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader title={name} back="/messages" />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
        {/* Stays under the header while the thread scrolls, so the transactions are always one tap away. */}
        <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top)+1px)] z-10 border-b border-zinc-200 bg-[var(--background)] px-3 py-1.5 dark:border-zinc-800">
          {view.replyTime ? <p className="pb-1 text-xs text-zinc-500">Typically replies {REPLY_LABEL[view.replyTime]}</p> : null}
          <Transactions listings={view.listings.map(withThumb)} />
        </div>
        {view.other.handle ? (
          <details className="border-b border-zinc-200 px-3 dark:border-zinc-800">
            <summary className="flex h-11 cursor-pointer items-center text-xs text-zinc-500">Block or report {name}</summary>
            <div className="flex flex-col gap-2 pb-3">
              <ReportControl target={{ kind: "student", handle: view.other.handle }} label="Report this student" className="h-11 w-full rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700" />
              <BlockButton handle={view.other.handle} className="h-11 w-full rounded-lg border border-zinc-300 text-sm font-medium disabled:opacity-60 dark:border-zinc-700" />
            </div>
          </details>
        ) : null}
        <ErrorBanner />
        <Chat conversationId={view.id} messages={messages} pinned={view.pinned.map(offerData)} unread={view.unread} readOnlyReason={view.readOnlyReason} otherName={name} />
      </main>
    </div>
  );
}
