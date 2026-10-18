// A small load check for the free tiers: sends bursts of requests to a few public
// endpoints and reports failures and latency percentiles.
//
//   node scripts/load-check.mjs https://studiskarte-marketplace.vercel.app [requests=200] [concurrency=20]
//
// Public pages only (no sign-in), so it needs no secrets and writes nothing. The
// database endpoint makes the app open a Neon connection each time, which is the
// part of the free plan most likely to run out first.
const [base, requestsArg, concurrencyArg] = process.argv.slice(2);
if (!base) {
  console.error("usage: node scripts/load-check.mjs <base url> [requests] [concurrency]");
  process.exit(1);
}
const requests = Number(requestsArg ?? 200);
const concurrency = Number(concurrencyArg ?? 20);
const paths = ["/sign-in", "/api/version", "/api/health/db"];

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

let failed = false;
for (const path of paths) {
  const url = new URL(path, base).href;
  const times = [];
  const statuses = new Map();
  let next = 0;
  const worker = async () => {
    while (next < requests) {
      next += 1;
      const started = performance.now();
      try {
        const response = await fetch(url, { cache: "no-store" });
        await response.arrayBuffer();
        statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
      } catch {
        statuses.set("network error", (statuses.get("network error") ?? 0) + 1);
      }
      times.push(performance.now() - started);
    }
  };
  const began = performance.now();
  await Promise.all(Array.from({ length: concurrency }, worker));
  const seconds = (performance.now() - began) / 1000;
  times.sort((a, b) => a - b);
  const bad = [...statuses].filter(([status]) => status !== 200).reduce((sum, [, n]) => sum + n, 0);
  if (bad > 0) failed = true;
  console.log(
    `${path}: ${requests} requests, ${concurrency} at a time, ${(requests / seconds).toFixed(1)}/s, ` +
      `p50 ${percentile(times, 50).toFixed(0)} ms, p95 ${percentile(times, 95).toFixed(0)} ms, max ${times[times.length - 1].toFixed(0)} ms, ` +
      `statuses ${[...statuses].map(([s, n]) => `${s}x${n}`).join(" ")}`,
  );
}
process.exit(failed ? 1 : 0);
