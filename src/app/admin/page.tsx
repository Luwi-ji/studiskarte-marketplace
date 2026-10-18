import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { STATUS_LABEL } from "@/lib/posts/format";
import { listAdminQueue, type ReportLine } from "@/lib/safety/admin";
import { REPORT_REASONS } from "@/lib/safety/report";
import { AdminButton } from "./admin-buttons";

export const metadata = { title: "Admin · Studiskarte Marketplace" };

const PICTURE_LINK_SECONDS = 5 * 60;
const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });
const reasonLabel = new Map(REPORT_REASONS.map((r) => [r.id, r.label]));

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Admin" back="/me/settings" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
          <Queue />
        </Suspense>
      </main>
    </>
  );
}

function Reports({ reports }: { reports: ReportLine[] }) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {reports.map((r, i) => (
        <li key={i}>
          <span className="font-medium">{reasonLabel.get(r.reason) ?? r.reason}</span>
          <span className="text-xs text-zinc-500"> · {dateFormat.format(r.createdAt)}</span>
          {r.details ? <span className="block text-zinc-600 dark:text-zinc-400">“{r.details}”</span> : null}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const card = "flex flex-col gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800";

async function Queue() {
  await requireAdmin();
  const queue = await listAdminQueue();
  const store = getObjectStore();
  const posts = await Promise.all(queue.posts.map(async (p) => ({ ...p, coverUrl: p.coverThumbKey ? await store.signedUrl(p.coverThumbKey, PICTURE_LINK_SECONDS) : null })));

  return (
    <div className="flex flex-col gap-8">
      <Section title="Posts to review">
        {posts.length === 0 ? <p className="text-sm text-zinc-500">Nothing to review.</p> : null}
        {posts.map((p) => (
          <div key={p.id} className={card}>
            <div className="flex gap-3">
              {p.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
              ) : (
                <div className="h-16 w-16 shrink-0 rounded-lg bg-zinc-200 dark:bg-zinc-800" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <Link href={`/posts/${p.id}`} className="flex min-h-11 items-center truncate font-medium underline">
                  {p.title}
                </Link>
                <p className="truncate text-sm text-zinc-500">
                  {STATUS_LABEL[p.status] ?? p.status} · {p.ownerHandle ? `@${p.ownerHandle}` : p.ownerName}
                </p>
              </div>
            </div>
            <p className="text-sm font-medium">
              {p.reporterCount} {p.reporterCount === 1 ? "report" : "reports"}
            </p>
            <Reports reports={p.reports} />
            <div className="flex flex-col gap-2">
              {p.status === "hidden" ? <AdminButton kind="restorePost" id={p.id} label="Restore" /> : null}
              <AdminButton kind="removePost" id={p.id} label="Remove" danger confirm="Remove this post? Any reservation on it is ended and the owner is told." />
              <AdminButton kind="dismissPost" id={p.id} label="Dismiss reports" />
            </div>
          </div>
        ))}
      </Section>

      <Section title="Students reported">
        {queue.students.length === 0 ? <p className="text-sm text-zinc-500">Nothing to review.</p> : null}
        {queue.students.map((s) => (
          <div key={s.id} className={card}>
            {s.handle ? (
              <Link href={`/u/${s.handle}`} className="flex min-h-11 items-center truncate font-medium underline">
                {s.displayName || `@${s.handle}`} · @{s.handle}
              </Link>
            ) : (
              <p className="truncate font-medium">{s.displayName}</p>
            )}
            <p className="text-sm font-medium">
              {s.reporterCount} {s.reporterCount === 1 ? "report" : "reports"}
            </p>
            <Reports reports={s.reports} />
            <div className="flex flex-col gap-2">
              {s.accountStatus === "active" ? (
                <AdminButton kind="suspendStudent" id={s.id} label="Suspend" danger confirm="Suspend this student? They are signed out everywhere and cannot sign in." />
              ) : null}
              <AdminButton kind="dismissStudent" id={s.id} label="Dismiss reports" />
            </div>
          </div>
        ))}
      </Section>

      <Section title="Suspended students">
        {queue.suspended.length === 0 ? <p className="text-sm text-zinc-500">Nobody is suspended.</p> : null}
        {queue.suspended.map((s) => (
          <div key={s.id} className={`${card} sm:flex-row`}>
            <p className="min-w-0 flex-1 truncate font-medium">
              {s.displayName}
              {s.handle ? <span className="text-sm font-normal text-zinc-500"> · @{s.handle}</span> : null}
            </p>
            <AdminButton kind="restoreStudent" id={s.id} label="Restore" />
          </div>
        ))}
      </Section>
    </div>
  );
}
