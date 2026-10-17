import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { listTransactions, type Transaction, type TransactionGroup } from "@/lib/deals/mine";
import { getObjectStore } from "@/lib/images/store";
import { formatPrice } from "@/lib/posts/format";

export const metadata = { title: "Transactions · Studiskarte Marketplace" };

const LINK_SECONDS = 5 * 60;

const SECTIONS: { group: TransactionGroup; title: string }[] = [
  { group: "waiting", title: "Waiting for an answer" },
  { group: "active", title: "In progress" },
  { group: "done", title: "Completed" },
  { group: "closed", title: "Cancelled" },
];

export default function TransactionsPage() {
  return (
    <>
      <PageHeader title="Transactions" back="/me/settings" />
      <main className="mx-auto w-full max-w-md flex-1 px-3 py-3">
        <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
          <Transactions />
        </Suspense>
      </main>
    </>
  );
}

async function Transactions() {
  const me = await requireActiveStudent();
  const items = await listTransactions(me.id);
  if (items.length === 0) {
    return <p className="px-6 py-16 text-center text-zinc-500">No transactions yet. An offer or a reservation, made or received, shows up here with what to do next.</p>;
  }
  const store = getObjectStore();
  const urls = new Map(await Promise.all(items.map(async (t): Promise<[string, string]> => [t.id, await store.signedUrl(t.thumbKey, LINK_SECONDS)])));

  return (
    <div className="flex flex-col gap-6">
      {SECTIONS.map(({ group, title }) => {
        const rows = items.filter((t) => t.group === group);
        if (rows.length === 0) return null;
        return (
          <section key={group} aria-label={title} className="flex flex-col gap-2">
            <h2 className="px-1 text-sm font-medium text-zinc-500">
              {title} · {rows.length}
            </h2>
            <ul className="flex flex-col gap-2">
              {rows.map((t) => (
                <li key={t.id}>
                  <Row item={t} thumbUrl={urls.get(t.id) ?? ""} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Row({ item, thumbUrl }: { item: Transaction; thumbUrl: string }) {
  const many = item.quantity > 1;
  const price = item.isReserve && item.amount === 0 ? "Free" : `${formatPrice("amount", item.amount)}${many ? ` × ${item.quantity}` : ""}`;
  return (
    <Link href={`/messages/${item.conversationId}`} className="flex min-h-[4.5rem] items-center gap-3 rounded-xl border border-zinc-200 p-2 active:opacity-80 dark:border-zinc-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumbUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.title}</p>
        <p className="truncate text-xs text-zinc-500">
          {item.role === "selling" ? "Selling to" : "Buying from"} {item.otherName} · {price}
        </p>
        <p className="text-sm">{item.state}</p>
      </div>
      <span aria-hidden className="text-xl text-zinc-400">
        ›
      </span>
    </Link>
  );
}
