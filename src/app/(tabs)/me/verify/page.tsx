import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { documentKindsFor, MAX_REJECTED_CHECKS, verificationEnabled } from "@/lib/verification/config";
import { getMyCheck, type MyCheck } from "@/lib/verification/service";
import { VerifyWizard, WithdrawSection } from "./verify-forms";

export const metadata = { title: "ID check · Studiskarte Marketplace" };

export default function VerifyPage() {
  if (!verificationEnabled()) notFound();
  return (
    <>
      <PageHeader title="ID check" back="/me/settings" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        <Suspense fallback={<VerifySkeleton />}><Verify /></Suspense>
      </main>
    </>
  );
}

function Shield({ done = false }: { done?: boolean }) {
  return <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${done ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-brand/10 text-brand-text"}`}><svg viewBox="0 0 24 24" className="h-7 w-7 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m12 3 8 3v6c0 4.6-3.3 8-8 9-4.7-1-8-4.4-8-9V6l8-3Z" />{done ? <path d="m8.5 12 2.2 2.2 4.8-5" /> : <path d="M12 8v5M12 16h.01" />}</svg></span>;
}

function Status({ title, text, done = false, children }: { title: string; text: string; done?: boolean; children?: ReactNode }) {
  return <div className="flex flex-col gap-6"><section className="flex items-start gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800"><Shield done={done} /><div className="min-w-0"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{text}</p></div></section>{children}</div>;
}

function Steps({ document, holding, sent }: { document: boolean; holding: boolean; sent: boolean }) {
  const rows = [["Consent", true], ["ID picture", document], ["Photo holding it", holding], ["Owner review", sent]] as const;
  return <ol className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">{rows.map(([label, done], index) => <li key={label} className="flex min-h-12 items-center gap-3"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${done ? "bg-brand text-white" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"}`}>{done ? "✓" : index + 1}</span><span className={done ? "font-medium" : "text-zinc-500"}>{label}</span></li>)}</ol>;
}

function VerifySkeleton() {
  return <div aria-hidden className="flex animate-pulse flex-col gap-5"><div className="flex gap-3"><div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800" /><div className="flex flex-1 flex-col gap-2"><div className="h-5 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" /><div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-800" /></div></div>{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-12 rounded-lg bg-zinc-200 dark:bg-zinc-800" />)}</div>;
}

function Rejection({ check }: { check: MyCheck }) {
  if (!check.lastRejection) return null;
  const left = Math.max(0, MAX_REJECTED_CHECKS - check.rejectedCount);
  return <section className="flex flex-col gap-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"><p className="font-medium">Your last ID check was not approved.</p>{check.lastRejection.reason ? <p>The owner wrote: {check.lastRejection.reason}</p> : null}{left > 0 ? <p>You can try again. {left === 1 ? "You have 1 try left." : `You have ${left} tries left.`}</p> : null}</section>;
}

async function Verify() {
  const me = await requireActiveStudent();
  const check = await getMyCheck(me.id);
  if (!check.enabled) notFound();
  if (check.checked) {
    const until = check.expiresAt?.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
    return <Status title={until ? `ID checked until ${until}` : "ID checked"} text="Your profile shows the ID checked badge. Your pictures were deleted when the owner decided." done><WithdrawSection state="approved" /></Status>;
  }
  if (check.open?.status === "pending") return <Status title="Waiting for review" text="The owner will decide. Your pictures are deleted as soon as they decide, or after 7 days."><Steps document holding sent /><WithdrawSection state="pending" /></Status>;
  if (check.open) return <div className="flex flex-col gap-6"><VerifyWizard key={check.open.id} kinds={documentKindsFor(me.role)} draft={{ documentKind: check.open.documentKind, hasDocument: check.open.hasDocument, hasHolding: check.open.hasHolding }} /><WithdrawSection state="draft" /></div>;
  if (check.cannotAskBecause) return <Status title="ID check unavailable" text={check.cannotAskBecause}><Rejection check={check} /></Status>;
  return <div className="flex flex-col gap-6"><VerifyWizard key="new" kinds={documentKindsFor(me.role)} draft={null} notice={<Rejection check={check} />} /></div>;
}
