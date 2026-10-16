import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cleanupUnusedPhotos } from "@/lib/jobs/cleanup";
import { expirePosts } from "@/lib/jobs/expire-posts";
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

async function runNamed(name: JobName): Promise<string> {
  if (name === "expire-posts") return runJob(name, async () => `expired ${await expirePosts()} posts`);
  return runJob(name, async () => `removed ${await cleanupUnusedPhotos(getObjectStore())} unused photos`);
}

/**
 * ?job=expire-posts | cleanup | all (default). Also reports jobs that have
 * stopped running, so a dead scheduler shows up in the response.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wanted = new URL(request.url).searchParams.get("job") ?? "all";
  if (wanted !== "all" && !isJobName(wanted)) {
    return NextResponse.json({ error: "Unknown job" }, { status: 400 });
  }
  const names = wanted === "all" ? (Object.keys(JOBS).filter(isJobName) as JobName[]) : [wanted];

  const results: Record<string, string> = {};
  let failed = false;
  for (const name of names) {
    try {
      results[name] = await runNamed(name);
    } catch (error) {
      failed = true;
      console.error(`job ${name} failed`, error);
      results[name] = "failed";
    }
  }
  const stale = await staleJobs();
  return NextResponse.json({ results, stale }, { status: failed ? 500 : 200 });
}
