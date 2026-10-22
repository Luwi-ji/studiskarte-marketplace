import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cleanupUnusedPhotos } from "@/lib/jobs/cleanup";
import { expireDeals } from "@/lib/jobs/expire-deals";
import { expireOffers } from "@/lib/jobs/expire-offers";
import { expirePosts } from "@/lib/jobs/expire-posts";
import { purgePosts } from "@/lib/jobs/purge-posts";
import { purgeRateLimits } from "@/lib/jobs/purge-rate-limits";
import { getIdStore } from "@/lib/images/store";
import { verificationEnabled } from "@/lib/verification/config";
import { expireChecks } from "@/lib/verification/service";
import { warnExpiringPosts } from "@/lib/jobs/expiry-warnings";
import { sendHandoverReminders } from "@/lib/jobs/reminders";
import { sendReviewReminders } from "@/lib/jobs/review-reminders";
import { healthWarnings, measureHealth } from "@/lib/jobs/health";
import { deliverAlert } from "@/lib/notifications/push/notify";
import { isJobName, JOBS, runJob, staleJobs, type JobName } from "@/lib/jobs/job-run";
import { getObjectStore } from "@/lib/images/store";

// Called by Vercel cron (daily) and by GitHub Actions (every 15 minutes), both
// with "Authorization: Bearer <CRON_SECRET>". GET because Vercel cron only does GET.
// Every job is safe to run twice.

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false; // unset or weak secret: nobody gets in
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Alerts are sent as each notice is written; the job waits for them, because this request is all the time they get.
async function runNamed(name: JobName, warnings: string[]): Promise<string> {
  const alerts: Promise<unknown>[] = [];
  const alert = (id: string) => void alerts.push(deliverAlert(id));
  if (name === "expire-posts") {
    return runJob(name, async () => {
      const n = await expirePosts(new Date(), alert);
      await Promise.all(alerts);
      return `expired ${n} posts`;
    });
  }
  if (name === "expire-offers") {
    return runJob(name, async () => {
      const n = await expireOffers(new Date(), alert);
      await Promise.all(alerts);
      return `expired ${n} offers`;
    });
  }
  if (name === "purge-posts") {
    return runJob(name, async () => `removed ${await purgePosts(new Date())} posts from owners' lists`);
  }
  if (name === "expire-deals") {
    return runJob(name, async () => {
      const n = await expireDeals(new Date(), alert);
      await Promise.all(alerts);
      return `cancelled ${n} idle reservations`;
    });
  }
  if (name === "handover-reminders") {
    return runJob(name, async () => {
      const n = await sendHandoverReminders(new Date(), alert);
      await Promise.all(alerts);
      return `sent ${n} reminders`;
    });
  }
  if (name === "expiry-warnings") {
    return runJob(name, async () => {
      const n = await warnExpiringPosts(new Date(), alert);
      await Promise.all(alerts);
      return `warned about ${n} posts`;
    });
  }
  if (name === "review-reminders") {
    return runJob(name, async () => {
      const n = await sendReviewReminders(new Date(), alert);
      await Promise.all(alerts);
      return `${n} review reminders`;
    });
  }
  if (name === "purge-rate-limits") {
    return runJob(name, async () => `removed ${await purgeRateLimits(new Date())} old rate-limit rows`);
  }
  if (name === "expire-id-checks") {
    return runJob(name, async () => {
      if (!verificationEnabled()) return "ID checks are not open";
      const { closed, lapsed } = await expireChecks(getIdStore());
      return `closed ${closed} old ID checks, ${lapsed} approvals lapsed`;
    });
  }
  if (name === "health") {
    return runJob(name, async () => {
      warnings.push(...healthWarnings(await measureHealth()));
      return warnings.length === 0 ? "no warnings" : `${warnings.length} warnings`;
    });
  }
  return runJob(name, async () => `removed ${await cleanupUnusedPhotos(getObjectStore())} unused photos`);
}

/**
 * ?job=expire-posts,purge-posts,expire-offers,expire-deals,handover-reminders,expiry-warnings,review-reminders,purge-rate-limits,expire-id-checks,cleanup,health (any, comma-separated) | all (default). Also reports jobs that have
 * stopped running, so a dead scheduler shows up in the response, and (when the health job
 * runs) "warnings": a near-full Gmail quota, photo storage or database.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wanted = (new URL(request.url).searchParams.get("job") ?? "all").split(",");
  const unknown = wanted.some((name) => name !== "all" && !isJobName(name));
  if (unknown) return NextResponse.json({ error: "Unknown job" }, { status: 400 });
  const names = wanted.includes("all") ? (Object.keys(JOBS).filter(isJobName) as JobName[]) : [...new Set(wanted.filter(isJobName))];

  const results: Record<string, string> = {};
  const warnings: string[] = [];
  let failed = false;
  for (const name of names) {
    try {
      results[name] = await runNamed(name, warnings);
    } catch (error) {
      failed = true;
      console.error(`job ${name} failed`, error);
      results[name] = "failed";
    }
  }
  const stale = await staleJobs();
  return NextResponse.json({ results, stale, warnings }, { status: failed ? 500 : 200 });
}
