import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/access";
import { getIdStore } from "@/lib/images/store";
import { MIN_AGE } from "@/lib/identity/age";
import { OPEN_CHECK_KEEP_DAYS, verificationEnabled } from "@/lib/verification/config";
import { listPendingChecks, viewPicture } from "@/lib/verification/service";
import { card, formatDateTime } from "../../admin-ui";
import { DecisionPanel } from "../decision-panel";
import { ageLabel, Chip, DocumentChip, isOverdue } from "../verification-ui";

export const metadata = { title: "Review ID check · Admin · Studiskarte Marketplace" };

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/verifications" className="inline-flex h-11 w-fit items-center gap-1 underline decoration-zinc-400 underline-offset-2">
        <span aria-hidden className="text-xl no-underline">‹</span>
        Back to ID checks
      </Link>
      <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
        <Review params={params} />
      </Suspense>
    </div>
  );
}

async function Review({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!verificationEnabled()) return <p className="text-zinc-600 dark:text-zinc-400">ID checks are not open (R2_ID_BUCKET is not set).</p>;
  const { id } = await params;
  const check = (await listPendingChecks()).find((c) => c.id === id);
  if (!check) notFound();

  const store = getIdStore();
  const [document, holding] = await Promise.all([
    viewPicture({ adminId: admin.id, verificationId: check.id, slot: "document", store }),
    viewPicture({ adminId: admin.id, verificationId: check.id, slot: "holding", store }),
  ]);
  const now = new Date();
  const attempt = check.earlierRejections + 1;

  return (
    <div className="flex flex-col gap-4">
      <header className={card}>
        <div>
          <h1 className="text-xl font-semibold">{check.displayName}</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {check.handle ? `@${check.handle}` : "No handle"} · {check.schoolDomain ?? "No school"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DocumentChip kind={check.documentKind} />
          <Chip>Role: {check.claimedRole}</Chip>
          <Chip tone={attempt > 1 ? "warn" : "plain"}>{attempt > 1 ? `Attempt ${attempt} (${check.earlierRejections} rejected before)` : "First attempt"}</Chip>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Submitted {formatDateTime(check.submittedAt)}.{" "}
          <span className={isOverdue(check.submittedAt, now, OPEN_CHECK_KEEP_DAYS) ? "font-medium text-amber-700 dark:text-amber-300" : undefined}>Waiting {ageLabel(check.submittedAt, now)}.</span>
        </p>
      </header>

      <section aria-label="Pictures" className="flex flex-col gap-3">
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { result: document, alt: "ID document", caption: "1. ID document" },
            { result: holding, alt: "Photo holding the ID", caption: "2. Photo holding the ID" },
          ].map(({ result, alt, caption }) => (
            <figure key={alt} className="flex flex-col gap-2">
              <figcaption className="text-sm font-semibold">{caption}</figcaption>
              {result.ok ? (
                // eslint-disable-next-line @next/next/no-img-element -- a short-lived private link; the optimizer must not cache it
                <img src={result.url} alt={alt} referrerPolicy="no-referrer" className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800" />
              ) : (
                <p role="alert" className="rounded-xl border border-red-300 p-3 text-sm text-red-700 dark:border-red-900 dark:text-red-400">
                  {alt}: {result.error}
                </p>
              )}
            </figure>
          ))}
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Each time you open these pictures it is written down.</p>
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold">Check that</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>The name on the document matches {check.displayName}.</li>
          <li>The school matches {check.schoolDomain}.</li>
          <li>The role matches the claim: {check.claimedRole}.</li>
          <li>The photo shows the same person holding the same document.</li>
          {check.claimedRole === "alumni" ? <li>The document shows they graduated from this school.</li> : <li>The document shows the person is at least {MIN_AGE} years old.</li>}
          <li>It is not an ID of someone else.</li>
        </ul>
      </section>

      <DecisionPanel id={check.id} />
    </div>
  );
}
