import { connection, NextResponse } from "next/server";
import { getPool } from "@/lib/db";

const CHECK_TTL_MS = 10_000;
const HEALTHY_CACHE = "public, max-age=0, s-maxage=15, stale-while-revalidate=30";
const NO_CACHE = "no-store";

let currentCheck: { until: number; result: Promise<boolean> } | undefined;

/** Share one short database check per function instance, including concurrent requests. */
function databaseIsHealthy(now = Date.now()): Promise<boolean> {
  if (currentCheck && currentCheck.until > now) return currentCheck.result;
  const result = getPool()
    .query("select 1")
    .then(() => true)
    .catch((error: unknown) => {
      console.error("db health check failed", error);
      return false;
    });
  currentCheck = { until: now + CHECK_TTL_MS, result };
  return result;
}

export async function GET(request: Request) {
  // Request-time only: never run this query while the app is being built.
  await connection();
  // Do not let arbitrary query strings create separate CDN cache entries and
  // force another database check.
  if (new URL(request.url).search !== "") {
    return NextResponse.json({ ok: false }, { status: 400, headers: { "Cache-Control": NO_CACHE } });
  }
  const ok = await databaseIsHealthy();
  return NextResponse.json(
    { ok },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": ok ? HEALTHY_CACHE : NO_CACHE },
    },
  );
}
