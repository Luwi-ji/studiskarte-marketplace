import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { MAX_REJECTED_CHECKS, verificationEnabled } from "@/lib/verification/config";
import { getMyCheck, type MyCheck } from "@/lib/verification/service";
import { documentKindsFor } from "@/lib/verification/config";
import { ConsentForm, UploadStep, WithdrawSection } from "./verify-forms";

export const metadata = { title: "ID check · Studiskarte Marketplace" };

export default function VerifyPage() {
  // The check is closed (404) until the private ID bucket is set.
  if (!verificationEnabled()) notFound();
  return (
    <>
      <PageHeader title="ID check" back="/me/settings" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
          <Verify />
        </Suspense>
      </main>
    </>
  );
}

function Rejection({ check }: { check: MyCheck }) {
  if (!check.lastRejection) return null;
  const left = Math.max(0, MAX_REJECTED_CHECKS - check.rejectedCount);
  return (
    <section className="flex flex-col gap-1 rounded-xl border border-zinc-300 p-3 text-sm dark:border-zinc-700">
      <p className="font-medium">Your last ID check was not approved.</p>
      {check.lastRejection.reason ? <p className="text-zinc-700 dark:text-zinc-300">The owner wrote: {check.lastRejection.reason}</p> : null}
      {left > 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">You can try again. {left === 1 ? "You have 1 try left." : `You have ${left} tries left.`}</p>
      ) : null}
    </section>
  );
}

async function Verify() {
  const me = await requireActiveStudent();
  const check = await getMyCheck(me.id);
  if (!check.enabled) notFound();

  if (check.checked) {
    const until = check.expiresAt?.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
    return (
      <div className="flex flex-col gap-6">
        <p className="text-lg font-semibold">ID checked{until ? ` until ${until}` : ""}</p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">Your profile shows the &ldquo;ID checked&rdquo; badge. Your pictures were deleted when the owner decided.</p>
        <WithdrawSection />
      </div>
    );
  }

  if (check.open?.status === "pending") {
    return (
      <div className="flex flex-col gap-6">
        <p className="text-lg font-semibold">Waiting for the owner</p>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">Waiting for the owner. Pictures are deleted as soon as they decide, or after 7 days.</p>
        <WithdrawSection />
      </div>
    );
  }

  if (check.open) {
    return (
      <div className="flex flex-col gap-6">
        <UploadStep hasDocument={check.open.hasDocument} hasHolding={check.open.hasHolding} />
        <WithdrawSection />
      </div>
    );
  }

  if (check.cannotAskBecause) {
    return (
      <div className="flex flex-col gap-4">
        <Rejection check={check} />
        <p className="text-zinc-700 dark:text-zinc-300">{check.cannotAskBecause}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Rejection check={check} />
      <ConsentForm kinds={documentKindsFor(me.role)} />
    </div>
  );
}
