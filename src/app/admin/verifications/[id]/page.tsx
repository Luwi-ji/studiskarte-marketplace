import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/access";
import { getIdStore } from "@/lib/images/store";
import { MIN_AGE } from "@/lib/identity/age";
import { verificationEnabled, DOCUMENT_LABEL } from "@/lib/verification/config";
import { listPendingChecks, viewPicture } from "@/lib/verification/service";
import { card, formatDateTime, link } from "../../admin-ui";
import { DecisionButtons } from "../decision-buttons";

export const metadata = { title: "Review ID check · Admin · Studiskarte Marketplace" };

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/verifications" className={link}>
        Back to ID checks
      </Link>
      <h1 className="text-xl font-semibold">Review ID check</h1>
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

  return (
    <div className="flex flex-col gap-4">
      <div className={card}>
        <div>
          <p className="font-medium">{check.displayName}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">@{check.handle} · {check.schoolDomain}</p>
        </div>
        <ul className="flex flex-col gap-0.5 text-sm">
          <li>Role: {check.claimedRole}</li>
          <li>Document: {DOCUMENT_LABEL[check.documentKind]}</li>
          <li>Submitted: {formatDateTime(check.submittedAt)}</li>
          {check.earlierRejections > 0 ? <li>Earlier rejections: {check.earlierRejections}</li> : null}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        {[
          { result: document, alt: "ID document" },
          { result: holding, alt: "Photo holding the ID" },
        ].map(({ result, alt }) =>
          result.ok ? (
            // eslint-disable-next-line @next/next/no-img-element -- a short-lived private link; the optimizer must not cache it
            <img key={alt} src={result.url} alt={alt} referrerPolicy="no-referrer" className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800" />
          ) : (
            <p key={alt} role="alert" className="text-sm text-red-600">
              {alt}: {result.error}
            </p>
          ),
        )}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Each time you open these pictures it is written down.</p>
      </div>

      <div className={card}>
        <p className="text-sm font-medium">Check that</p>
        <ul className="list-disc pl-5 text-sm">
          <li>The name on the document matches {check.displayName}.</li>
          <li>The school matches {check.schoolDomain}.</li>
          <li>The role matches the claim: {check.claimedRole}.</li>
          <li>The photo shows the same person holding the same document.</li>
          {check.claimedRole === "alumni" ? <li>The document shows they graduated from this school.</li> : <li>The document shows the person is at least {MIN_AGE} years old.</li>}
          <li>It is not an ID of someone else.</li>
        </ul>
      </div>

      <DecisionButtons id={check.id} />
    </div>
  );
}
