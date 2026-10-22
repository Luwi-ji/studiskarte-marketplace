import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/access";
import { verificationEnabled, DOCUMENT_LABEL } from "@/lib/verification/config";
import { listPendingChecks } from "@/lib/verification/service";
import { card, formatDateTime, link } from "../admin-ui";

export const metadata = { title: "ID checks · Admin · Studiskarte Marketplace" };

export default function VerificationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">ID checks</h1>
      <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
        <Pending />
      </Suspense>
    </div>
  );
}

async function Pending() {
  await requireAdmin();
  if (!verificationEnabled()) return <p className="text-zinc-600 dark:text-zinc-400">ID checks are not open (R2_ID_BUCKET is not set).</p>;
  const checks = await listPendingChecks();
  if (checks.length === 0) return <p className="text-zinc-600 dark:text-zinc-400">Nothing waiting.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {checks.map((c) => (
        <li key={c.id} className={card}>
          <div>
            <p className="font-medium">{c.displayName}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">@{c.handle} · {c.schoolDomain}</p>
          </div>
          <ul className="flex flex-col gap-0.5 text-sm">
            <li>Role: {c.claimedRole}</li>
            <li>Document: {DOCUMENT_LABEL[c.documentKind]}</li>
            <li>Submitted: {formatDateTime(c.submittedAt)}</li>
            {c.earlierRejections > 0 ? <li>Earlier rejections: {c.earlierRejections}</li> : null}
          </ul>
          <Link href={`/admin/verifications/${c.id}`} prefetch={false} className={link}>
            Review
          </Link>
        </li>
      ))}
    </ul>
  );
}
