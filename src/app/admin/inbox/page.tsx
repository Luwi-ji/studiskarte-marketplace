import { Suspense } from "react";
import { requireAdmin } from "@/lib/access";
import { getInbox } from "@/lib/admin/inbox";
import { formatDateTime } from "../admin-ui";
import { MessageRow } from "./message-row";

export const metadata = { title: "Inbox · Admin · Studiskarte Marketplace" };

export default function InboxPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Inbox</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">What visitors left on the landing page. Delete a message once you have answered it.</p>
      </div>
      <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  await requireAdmin();
  const inbox = await getInbox();
  const most = Math.max(1, ...inbox.votes.map((v) => v.count));

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Messages {inbox.messages.length > 0 ? `(${inbox.messages.length})` : ""}</h2>
        {inbox.messages.length === 0 ? (
          <p className="text-sm text-zinc-500">No messages.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {inbox.messages.map((m) => (
              <MessageRow key={m.id} id={m.id} name={m.name} email={m.email} message={m.message} when={formatDateTime(m.createdAt)} />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Shops students want</h2>
        {inbox.suggestions.length === 0 ? (
          <p className="text-sm text-zinc-500">No suggestions yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {inbox.suggestions.map((s) => (
              <li key={s.shop.toLowerCase()} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{s.shop}</span>
                  <span className="text-xs text-zinc-500">Last asked {formatDateTime(s.lastAt)}</span>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold tabular-nums dark:bg-zinc-800">{s.count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Perk votes {inbox.totalVotes > 0 ? `(${inbox.totalVotes})` : ""}</h2>
        <ul className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          {inbox.votes.map((v) => (
            <li key={v.kind} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span>{v.label}</span>
                <span className="font-semibold tabular-nums">{v.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden>
                <div className="h-full rounded-full bg-brand" style={{ width: `${(v.count / most) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
