import { Suspense } from "react";
import { requireAdmin } from "@/lib/access";
import { getSystemStatus, type JobState, type Usage } from "@/lib/admin/system";
import { WARN_AT_PERCENT } from "@/lib/jobs/health";
import { verificationEnabled } from "@/lib/verification/config";
import { card, formatBytes, formatCount, formatDateTime, formatShare, link, Section, Stat } from "../admin-ui";

export const metadata = { title: "System · Admin · Studiskarte Marketplace" };

const DASHBOARDS = [
  { name: "Vercel", href: "https://vercel.com/dashboard", note: "Deployments, logs, cron" },
  { name: "Neon", href: "https://console.neon.tech/", note: "Database, branches, restore" },
  { name: "Resend", href: "https://resend.com/emails", note: "Sent mail and delivery" },
  { name: "Sentry", href: "https://sentry.io/", note: "Errors" },
] as const;

const JOB_STATE: Record<JobState, { label: string; className: string }> = {
  ok: { label: "OK", className: "text-emerald-700 dark:text-emerald-400" },
  running: { label: "Running", className: "text-zinc-700 dark:text-zinc-300" },
  overdue: { label: "Overdue", className: "text-red-700 dark:text-red-400" },
  failed: { label: "Failed", className: "text-red-700 dark:text-red-400" },
  never_ran: { label: "Never ran", className: "text-red-700 dark:text-red-400" },
};

export default function SystemPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">System</h1>
      <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
        <Status />
      </Suspense>
    </div>
  );
}

function UsageBar({ usage }: { usage: Usage }) {
  const percent = usage.share.share === null ? 0 : usage.share.share * 100;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="presentation">
      <div className={`h-2 rounded-full ${percent >= WARN_AT_PERCENT ? "bg-red-600" : "bg-brand"}`} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

function UsageCard({ label, used, usage, caption }: { label: string; used: string; usage: Usage; caption: string }) {
  return (
    <div className={card}>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">
        {used} <span className="text-sm font-normal text-zinc-500">({formatShare(usage.share)})</span>
      </p>
      <UsageBar usage={usage} />
      <p className="text-xs text-zinc-500">{caption}</p>
    </div>
  );
}

async function Status() {
  await requireAdmin();
  const s = await getSystemStatus();

  return (
    <div className="flex flex-col gap-8">
      <Section title="Limits">
        <div className="grid gap-3 md:grid-cols-3">
          <UsageCard
            label="Mail, last 24 hours"
            used={`${formatCount(s.mail.used)} of ${formatCount(s.mail.limit)}`}
            usage={s.mail}
            caption={`Emails sent by the app. Sending stops at ${formatCount(s.mailStopAt)} so the provider's cap is never hit.`}
          />
          <UsageCard
            label="Database"
            used={`${formatBytes(s.database.used)} of ${formatBytes(s.database.limit)}`}
            usage={s.database}
            caption="Space used in Neon against the free plan. The health job warns at 80%."
          />
          <UsageCard
            label="Photo storage"
            used={`${formatBytes(s.storage.used)} of ${formatBytes(s.storage.limit)}`}
            usage={s.storage}
            caption="Photos in R2 against the free plan. An estimate: main pictures from their recorded sizes plus a margin for thumbnails."
          />
        </div>
      </Section>

      <Section title="Scheduled jobs">
        <div className={`${card} overflow-x-auto`}>
          <p className="text-xs text-zinc-500">Each job should finish within the time shown. A job that is overdue, failed or never ran means the scheduler needs a look (GitHub Actions and Vercel cron).</p>
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-1 pr-3 font-medium">Job</th>
                <th className="py-1 pr-3 font-medium">State</th>
                <th className="py-1 pr-3 font-medium">Last finished</th>
                <th className="py-1 pr-3 font-medium">Expected within</th>
                <th className="py-1 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {s.jobs.map((job) => (
                <tr key={job.name} className="border-t border-zinc-200 align-top dark:border-zinc-800">
                  <td className="py-1.5 pr-3 font-medium">{job.name}</td>
                  <td className={`py-1.5 pr-3 font-medium ${JOB_STATE[job.state].className}`}>{JOB_STATE[job.state].label}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3">{job.lastFinishedAt ? formatDateTime(job.lastFinishedAt) : "–"}</td>
                  <td className="whitespace-nowrap py-1.5 pr-3">{job.maxAgeMinutes >= 120 ? `${job.maxAgeMinutes / 60} h` : `${job.maxAgeMinutes} min`}</td>
                  <td className="py-1.5 text-zinc-600 dark:text-zinc-400">{job.detail ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Terms and sign-up">
        <div className="grid gap-3 md:grid-cols-3">
          <Stat
            label="Legal version"
            value={s.legal.version ?? "None"}
            caption={s.legal.version === null ? "The legal text is not in place, so nobody is asked to accept anything." : "Changing content/legal/VERSION asks every account to accept again."}
          />
          <Stat
            label="Accepted the current version"
            value={s.legal.version === null ? "–" : `${formatCount(s.legal.accepted.numerator)} of ${formatCount(s.legal.accepted.denominator)}`}
            caption={`Active accounts that accepted it${s.legal.version === null ? "" : ` (${formatShare(s.legal.accepted)})`}. Others are asked at their next visit.`}
          />
          <Stat
            label="Guests can sign up"
            value={s.visitorsAllowed ? "Yes" : "No"}
            caption="People without a school email. Set by ALLOW_VISITORS in the Vercel environment."
          />
          <Stat
            label="ID checks"
            value={verificationEnabled() ? "On" : "Off"}
            caption="On when R2_ID_BUCKET is set in Vercel. Off hides the check screens and the one-showcase limit. Remove the variable and redeploy to stop them."
          />
        </div>
      </Section>

      <Section title="Dashboards">
        <ul className="grid gap-3 md:grid-cols-4">
          {DASHBOARDS.map((d) => (
            <li key={d.name} className={card}>
              <a href={d.href} target="_blank" rel="noopener noreferrer" className={`flex min-h-11 items-center font-medium ${link}`}>
                {d.name} ↗
              </a>
              <p className="text-xs text-zinc-500">{d.note}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
