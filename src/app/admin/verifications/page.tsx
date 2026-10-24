import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/access";
import { OPEN_CHECK_KEEP_DAYS, verificationEnabled } from "@/lib/verification/config";
import { CHECK_STATUSES, countChecksByStatus, listChecksByStatus, listPendingChecks, type CheckCounts, type CheckStatus } from "@/lib/verification/service";
import { card, formatDate, formatDateTime } from "../admin-ui";
import { ageLabel, Chip, DocumentChip, isOverdue, STATUS_LABEL } from "./verification-ui";

export const metadata = { title: "ID checks · Admin · Studiskarte Marketplace" };

export default function VerificationsPage({ searchParams }: PageProps<"/admin/verifications">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">ID checks</h1>
      <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
        <Checks searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function parseStatus(value: string | string[] | undefined): CheckStatus {
  const raw = Array.isArray(value) ? value[0] : value;
  return CHECK_STATUSES.find((s) => s === raw) ?? "pending";
}

async function Checks({ searchParams }: Pick<PageProps<"/admin/verifications">, "searchParams">) {
  await requireAdmin();
  if (!verificationEnabled()) return <p className="text-zinc-600 dark:text-zinc-400">ID checks are not open (R2_ID_BUCKET is not set).</p>;
  const status = parseStatus((await searchParams).status);
  const counts = await countChecksByStatus();
  return (
    <div className="flex flex-col gap-4">
      <StatusChips active={status} counts={counts} />
      {status === "pending" ? <PendingList /> : <PastList status={status} />}
    </div>
  );
}

/** Pending first, then the rest. Each chip is a link, so the filter is in the address. */
function StatusChips({ active, counts }: { active: CheckStatus; counts: CheckCounts }) {
  return (
    <nav aria-label="Filter by status" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-2">
        {CHECK_STATUSES.map((s) => (
          <li key={s}>
            <Link
              href={s === "pending" ? "/admin/verifications" : `/admin/verifications?status=${s}`}
              prefetch={false}
              aria-current={s === active ? "page" : undefined}
              className={`flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium ${s === active ? "border-brand bg-brand text-white" : "border-zinc-300 dark:border-zinc-700"}`}
            >
              {STATUS_LABEL[s]}
              <span className={`tabular-nums ${s === active ? "text-white/80" : s === "pending" && counts.pending > 0 ? "font-semibold text-brand-text" : "text-zinc-500"}`}>{counts[s]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Waiting for the owner, oldest first, each one a single tap to the review. */
async function PendingList() {
  const checks = await listPendingChecks();
  if (checks.length === 0) return <p className="text-zinc-600 dark:text-zinc-400">Nothing waiting.</p>;
  const now = new Date();
  return (
    <>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Oldest first. Pictures are deleted when you decide, or after {OPEN_CHECK_KEEP_DAYS} days.</p>
      <ul className="flex flex-col gap-3">
        {checks.map((c) => (
          <li key={c.id}>
            <Link href={`/admin/verifications/${c.id}`} prefetch={false} className={`${card} press`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.displayName}</p>
                  <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                    {c.handle ? `@${c.handle}` : "No handle"} · {c.schoolDomain ?? "No school"}
                  </p>
                </div>
                <Chip tone={isOverdue(c.submittedAt, now, OPEN_CHECK_KEEP_DAYS) ? "warn" : "plain"}>Waiting {ageLabel(c.submittedAt, now)}</Chip>
              </div>
              <div className="flex flex-wrap gap-2">
                <DocumentChip kind={c.documentKind} />
                <Chip>{c.claimedRole}</Chip>
                {c.earlierRejections > 0 ? <Chip tone="warn">Attempt {c.earlierRejections + 1}</Chip> : null}
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">Submitted {formatDateTime(c.submittedAt)}</span>
                <span className="font-medium text-brand-text">Review</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Checks that are no longer open. Their pictures are already deleted, so there is nothing to open: this is a record. */
async function PastList({ status }: { status: Exclude<CheckStatus, "pending"> }) {
  const checks = await listChecksByStatus(status);
  if (checks.length === 0) return <p className="text-zinc-600 dark:text-zinc-400">No {STATUS_LABEL[status].toLowerCase()} checks.</p>;
  const now = new Date();
  return (
    <>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Newest first, up to 50. The pictures of these checks are already deleted.</p>
      <ul className="flex flex-col gap-3">
        {checks.map((c) => (
          <li key={c.id} className={card}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.displayName}</p>
                <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                  {c.handle ? `@${c.handle}` : "No handle"} · {c.schoolDomain ?? "No school"}
                </p>
              </div>
              <Chip>{ageLabel(c.at, now)} ago</Chip>
            </div>
            <div className="flex flex-wrap gap-2">
              <DocumentChip kind={c.documentKind} />
              <Chip>{c.claimedRole}</Chip>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {STATUS_LABEL[c.status]} {formatDate(c.at)}
              {c.reason ? `. Reason: ${c.reason}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
