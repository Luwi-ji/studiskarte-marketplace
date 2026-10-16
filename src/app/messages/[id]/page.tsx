import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { getConversation } from "@/lib/messaging/read";
import { Chat, type ChatMessageData } from "./chat";
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
  const messages = await Promise.all(
    view.messages.map(
      async (m): Promise<ChatMessageData> => ({
        id: m.id,
        mine: m.mine,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        listing: m.listing ? withThumb(m.listing) : null,
        offer: m.offer
          ? {
              ...m.offer,
              expiresAt: m.offer.expiresAt.toISOString(),
              listing: { post: m.offer.post, thumbUrl: thumbUrls.get(m.offer.post.id) ?? "" },
            }
          : null,
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
          <Transactions listings={view.listings.map(withThumb)} />
        </div>
        <Chat conversationId={view.id} messages={messages} unread={view.unread} readOnlyReason={view.readOnlyReason} otherName={name} />
      </main>
    </div>
  );
}
