import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/access";
import { ACTION_LABEL, listDisputes, listRecentActions } from "@/lib/admin/disputes";
import { getModerationCounts } from "@/lib/admin/moderation";
import { REPORT_REASONS as DEAL_REASONS, type ReportReason as DealReason } from "@/lib/deals/slot";
import { getObjectStore } from "@/lib/images/store";
import { STATUS_LABEL } from "@/lib/posts/format";
import { listAdminQueue, type ReportLine } from "@/lib/safety/admin";
import { REPORT_REASONS } from "@/lib/safety/report";
import { AdminButton } from "../admin-buttons";
import { card, formatCount, formatDate, formatDateTime, Section, Stat } from "../admin-ui";

export const metadata = { title: "Moderation · Admin · Studiskarte Marketplace" };

const PICTURE_LINK_SECONDS = 5 * 60;
const reasonLabel = new Map(REPORT_REASONS.map((r) => [r.id, r.label]));

export default function ModerationPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Moderation</h1>
      <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
        <Queue />
      </Suspense>
    </div>
  );
}

function Reports({ reports }: { reports: ReportLine[] }) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {reports.map((r, i) => (
        <li key={i}>
          <span className="font-medium">{reasonLabel.get(r.reason) ?? r.reason}</span>
          <span className="text-xs text-zinc-500"> · {formatDate(r.createdAt)}</span>
          {r.details ? <span className="block text-zinc-600 dark:text-zinc-400">“{r.details}”</span> : null}
        </li>
      ))}
    </ul>
  );
}

async function Queue() {
  await requireAdmin();
  const [queue, counts, disputes, recent] = await Promise.all([listAdminQueue(), getModerationCounts(), listDisputes(), listRecentActions()]);
  const store = getObjectStore();
  const posts = await Promise.all(queue.posts.map(async (p) => ({ ...p, coverUrl: p.coverThumbKey ? await store.signedUrl(p.coverThumbKey, PICTURE_LINK_SECONDS) : null })));

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Open reports" value={formatCount(counts.openReports)} caption="Reports about posts and students that nobody has decided yet." />
        <Stat label="Hidden posts" value={formatCount(counts.hiddenPosts)} caption="Posts hidden after reports. Restore or remove each one below." />
        <Stat label="Suspended accounts" value={formatCount(counts.suspendedAccounts)} caption="People who cannot sign in until you restore them." />
        <Stat label="Deleted accounts" value={formatCount(counts.deletedAccounts)} caption="People who deleted their own account. Their data is erased." />
      </div>

      <Section title="Posts to review">
        {posts.length === 0 ? <p className="text-sm text-zinc-500">Nothing to review.</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
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
                {p.status === "hidden" ? <AdminButton kind="restorePost" id={p.id} label="Restore" ask="optional" /> : null}
                <AdminButton kind="removePost" id={p.id} label="Remove" danger ask="required" confirm="Remove this post? Any reservation on it is ended and the owner is told, with your reason." />
                <AdminButton kind="dismissPost" id={p.id} label="Dismiss reports" />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Students reported">
        {queue.students.length === 0 ? <p className="text-sm text-zinc-500">Nothing to review.</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
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
                  <AdminButton kind="suspendStudent" id={s.id} label="Suspend" danger ask="required" confirm="Suspend this student? They are signed out everywhere and cannot sign in." />
                ) : null}
                <AdminButton kind="dismissStudent" id={s.id} label="Dismiss reports" />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Suspended students">
        {queue.suspended.length === 0 ? <p className="text-sm text-zinc-500">Nobody is suspended.</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {queue.suspended.map((s) => (
            <div key={s.id} className={`${card} sm:flex-row`}>
              <p className="min-w-0 flex-1 truncate font-medium">
                {s.displayName}
                {s.handle ? <span className="text-sm font-normal text-zinc-500"> · @{s.handle}</span> : null}
              </p>
              <AdminButton kind="restoreStudent" id={s.id} label="Restore" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Deal problems">
        <p className="text-sm text-zinc-500">Reservations where someone reported a problem and the deal is not over. The app moves no money, so there is nothing to refund: read both sides, then decide whether to message them, remove the post or suspend someone.</p>
        {disputes.length === 0 ? <p className="text-sm text-zinc-500">No open problems.</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          {disputes.map((d) => (
            <div key={d.dealId} className={card}>
              <Link href={`/posts/${d.postId}`} className="flex min-h-11 items-center truncate font-medium underline">
                {d.postTitle}
              </Link>
              <p className="text-sm">
                {d.status === "disputed" ? <span className="font-medium text-red-600">Disputed: nobody completed it</span> : <span>Reservation {d.status}</span>}
                {" · "}
                {d.ownerHandle ? `@${d.ownerHandle}` : "owner"} and {d.responderHandle ? `@${d.responderHandle}` : "buyer"}
              </p>
              <ul className="flex flex-col gap-1 text-sm">
                {d.reports.map((r, i) => (
                  <li key={i}>
                    <span className="font-medium">{r.reporterHandle ? `@${r.reporterHandle}` : "Someone"}:</span> {DEAL_REASONS[r.reason as DealReason] ?? r.reason} · {formatDate(r.createdAt)}
                    {r.details ? <span className="block text-zinc-600 dark:text-zinc-400">“{r.details}”</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Recent decisions">
        {recent.length === 0 ? <p className="text-sm text-zinc-500">Nothing decided yet.</p> : null}
        <ul className="flex flex-col gap-2 text-sm">
          {recent.map((a) => (
            <li key={a.id} className="flex flex-col rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <span>
                <span className="font-medium">{ACTION_LABEL[a.action] ?? a.action}</span>
                {a.targetHandle ? ` · @${a.targetHandle}` : ""}
                {a.postId ? (
                  <>
                    {" · "}
                    <Link href={`/posts/${a.postId}`} className="underline">
                      post
                    </Link>
                  </>
                ) : null}
              </span>
              <span className="text-zinc-500">
                {formatDateTime(a.createdAt)}
                {a.adminHandle ? ` · @${a.adminHandle}` : ""}
              </span>
              {a.reason ? <span className="text-zinc-700 dark:text-zinc-300">“{a.reason}”</span> : null}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
