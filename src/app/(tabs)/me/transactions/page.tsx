import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { listTransactions } from "@/lib/deals/mine";
import { getObjectStore } from "@/lib/images/store";
import { TransactionsView, type TransactionRow } from "./transactions-view";

export const metadata = { title: "Transactions · Studiskarte Marketplace" };
const LINK_SECONDS = 5 * 60;

export default function TransactionsPage() {
  return (
    <>
      <PageHeader title="Transactions" back="/me/settings" />
      <main className="mx-auto w-full max-w-md flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <Suspense fallback={<TransactionsSkeleton />}>
          <Transactions />
        </Suspense>
      </main>
    </>
  );
}

function TransactionsSkeleton() {
  return (
    <div aria-hidden className="motion-safe:animate-pulse">
      <div className="h-22 border-b border-zinc-200 px-3 py-3 dark:border-zinc-800"><div className="h-5 w-28 rounded bg-zinc-200 dark:bg-zinc-800" /><div className="mt-4 h-8 w-full rounded bg-zinc-200 dark:bg-zinc-800" /></div>
      {Array.from({ length: 5 }, (_, i) => <div key={i} className="flex gap-3 border-b border-zinc-200 px-3 py-3 dark:border-zinc-800"><div className="h-16 w-16 rounded-lg bg-zinc-200 dark:bg-zinc-800" /><div className="flex flex-1 flex-col gap-2"><div className="h-4 w-4/5 rounded bg-zinc-200 dark:bg-zinc-800" /><div className="h-3 w-2/3 rounded bg-zinc-200 dark:bg-zinc-800" /><div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" /></div></div>)}
    </div>
  );
}

async function Transactions() {
  const me = await requireActiveStudent();
  const items = await listTransactions(me.id);
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">No transactions yet. Offers and reservations appear here with what to do next.</p>
        <Link href="/" className="flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white">Browse the feed</Link>
      </div>
    );
  }
  const store = getObjectStore();
  const rows: TransactionRow[] = await Promise.all(items.map(async (item) => ({
    id: item.id,
    postId: item.postId,
    title: item.title,
    kind: item.kind,
    thumbUrl: await store.signedUrl(item.thumbKey, LINK_SECONDS),
    otherName: item.otherName,
    otherHandle: item.otherHandle,
    quantity: item.quantity,
    amount: item.amount,
    group: item.group,
    chip: item.chip,
    state: item.state,
    action: item.action,
    conversationId: item.conversationId,
    at: item.at.toISOString(),
  })));
  return <TransactionsView rows={rows} />;
}
