import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { VerifiedBadge } from "@/components/verified-badge";
import { GuestBadge } from "@/components/guest-badge";
import { requireActiveStudent } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { getConversation, type OfferCard } from "@/lib/messaging/read";
import { listTransactions } from "@/lib/deals/mine";
import { conversationTurn } from "@/lib/deals/turn";
import { TurnChip } from "@/components/turn-chip";
import { MenuSheet } from "@/app/safety/menu-sheet";
import { REPORT_REASONS } from "@/lib/safety/report";
import { Chat, type ChatMessageData } from "./chat";
import type { OfferCardData } from "./offer-card";
import { ErrorBanner } from "./error-banner";
import { TransactionList, type ListingCardData } from "./transactions";

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
  // The same chip as in the Messages list: whose move any ongoing offer or reservation here is waiting for.
  const [view, ongoing] = await Promise.all([getConversation(me.id, id.data), listTransactions(me.id, { ongoing: true, conversationId: id.data })]);
  if (!view) notFound();
  const turn = conversationTurn(ongoing.map((t) => t.turn));

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

  const { profile } = view;
  const handle = view.other.handle;
  const listings = view.listings.map(withThumb);

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader
        title={
          // One line: name, school-email badge, school abbreviation. The name gives way first when it is long.
          <span className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate">{name}</span>
            {profile.isGuest ? <GuestBadge interactive={false} /> : profile.schoolEmailChecked ? <VerifiedBadge interactive={false} /> : null}
            <span className="shrink-0 text-sm font-normal text-zinc-600 dark:text-zinc-400">{profile.schoolShort}</span>
            <TurnChip turn={turn} />
          </span>
        }
        titleHref={handle ? `/u/${handle}?thread=${view.id}` : undefined}
        back="/messages"
        action={
          handle || listings.length > 0 ? (
            <MenuSheet
              trigger="plain"
              reasons={REPORT_REASONS}
              name={name}
              handle={handle}
              blockHandle={handle ?? undefined}
              before={
                listings.length > 0
                  ? [{ id: "transactions", icon: "receipt", label: "Transactions", detail: String(listings.length), title: "Transactions", content: <TransactionList listings={listings} /> }]
                  : undefined
              }
            />
          ) : null
        }
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <ErrorBanner />
        <Chat conversationId={view.id} messages={messages} pinned={view.pinned.map(offerData)} unread={view.unread} readOnlyReason={view.readOnlyReason} otherName={name} />
      </main>
    </div>
  );
}
