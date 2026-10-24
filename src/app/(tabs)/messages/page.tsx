import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { TurnChip } from "@/components/turn-chip";
import { requireActiveStudent } from "@/lib/access";
import { listTransactions } from "@/lib/deals/mine";
import { compareTurn, conversationTurn, type Turn } from "@/lib/deals/turn";
import { getObjectStore } from "@/lib/images/store";
import { listConversations, type ConversationSummary } from "@/lib/messaging/read";
import { OngoingTransactions, type OngoingRow } from "./ongoing-transactions";

export const metadata = { title: "Messages · Studiskarte Marketplace" };

const LINK_SECONDS = 5 * 60;
const timeFormat = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
const dateFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" });

/** "3:42 PM" today, "Oct 15" otherwise (Philippine time). */
function when(at: Date, now = new Date()): string {
  return dateFormat.format(at) === dateFormat.format(now) ? timeFormat.format(at) : dateFormat.format(at);
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Messages" />
          <main className="mx-auto w-full max-w-md flex-1">
            <p className="p-4 text-zinc-500">Loading…</p>
          </main>
        </>
      }
    >
      <Inbox />
    </Suspense>
  );
}

async function Inbox() {
  const me = await requireActiveStudent();
  const store = getObjectStore();
  const [conversations, ongoing] = await Promise.all([listConversations(me.id), listTransactions(me.id, { ongoing: true })]);
  // "Your turn" first, then "Waiting for them"; the most recently changed first within each (the list is already in that order).
  const rows: OngoingRow[] = await Promise.all(
    ongoing
      .sort((a, b) => compareTurn(a.turn, b.turn))
      .map(async (t) => ({
        id: t.id,
        offerId: t.offerId,
        title: t.title,
        kind: t.kind,
        thumbUrl: await store.signedUrl(t.thumbKey, LINK_SECONDS),
        otherName: t.otherName,
        otherHandle: t.otherHandle,
        turn: t.turn,
        chip: t.chip,
        state: t.state,
        conversationId: t.conversationId,
      })),
  );
  // A conversation can hold several: it needs the viewer if any of them does.
  const turns: Record<string, Turn> = {};
  for (const t of ongoing) turns[t.conversationId] = conversationTurn([turns[t.conversationId], t.turn]);

  return (
    <>
      <PageHeader title="Messages" action={<OngoingTransactions rows={rows} />} />
      <main className="mx-auto w-full max-w-md flex-1">
        <Conversations conversations={conversations} turns={turns} />
      </main>
    </>
  );
}

async function Conversations({ conversations, turns }: { conversations: ConversationSummary[]; turns: Record<string, Turn> }) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">No messages yet. Open a post and tap Message to ask the seller a question.</p>
        <Link href="/" className="flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white">
          Browse the feed
        </Link>
      </div>
    );
  }
  const store = getObjectStore();
  const pictures = await Promise.all(conversations.map((c) => (c.other.avatarThumbKey ? store.signedUrl(c.other.avatarThumbKey, LINK_SECONDS) : null)));

  return (
    <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
      {conversations.map((c, index) => {
        const name = c.other.displayName || (c.other.handle ? `@${c.other.handle}` : "Student");
        const last = c.lastMessage;
        const what = last?.offer ? (last.offer.isReserve ? "Reserve request" : `Offer: ₱${last.offer.amount.toLocaleString("en-PH")}`) : (last?.body ?? "Sent a picture");
        const preview = last ? `${last.fromMe ? "You: " : ""}${what}` : "";
        return (
          <li key={c.id}>
            <Link href={`/messages/${c.id}`} className="flex min-h-[4.5rem] items-center gap-3 px-3 py-2 active:bg-zinc-100 dark:active:bg-zinc-900">
              {pictures[index] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pictures[index]} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold dark:bg-zinc-800" aria-hidden>
                  {name.replace("@", "").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`truncate ${c.unread > 0 ? "font-semibold" : "font-medium"}`}>{name}</p>
                  {c.lastMessage ? <span className="shrink-0 text-xs text-zinc-500">{when(c.lastMessage.at)}</span> : null}
                </div>
                <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <TurnChip turn={turns[c.id] ?? "none"} />
                  <span className="min-w-0 truncate">{c.listingCount > 1 ? `${c.listingCount} transactions` : c.listingTitle}</span>
                </p>
                <p className={`truncate text-sm ${c.unread > 0 ? "font-medium text-zinc-900 dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-400"}`}>{preview}</p>
              </div>
              {c.unread > 0 ? (
                <span aria-label={`${c.unread} unread`} className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-semibold text-white">
                  {c.unread > 99 ? "99+" : c.unread}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
