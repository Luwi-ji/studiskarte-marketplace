import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { clientIp } from "@/lib/identity/auth";
import { getPartnerReport } from "@/lib/perks/partner-report";
import { consume } from "@/lib/rate-limit";

// A shop's private page: never listed, and the link is never passed on to other sites.
export const metadata = { title: "Perk report · Studiskarte", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

const time = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

export default function PartnerReportPage({ params }: PageProps<"/partner/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 pb-16 pt-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Studiskarte" className="h-12 w-12 rounded-2xl shadow-md" />
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Report params={params} />
      </Suspense>
    </main>
  );
}

async function Report({ params }: { params: PageProps<"/partner/[token]">["params"] }) {
  const { token } = await params;
  const allowed = await consume({ action: "partner_report", key: clientIp(await headers()) ?? "unknown", max: 60, windowSeconds: 3600 });
  if (!allowed) return <p role="status">Too many requests. Try again later.</p>;
  const report = await getPartnerReport(token);
  if (!report) notFound();

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Perk report for {report.partnerName}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Private link. Do not share it. Counts update as students redeem.</p>
      </div>

      {report.perks.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">No claims yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {report.perks.map((p) => (
            <li key={p.title} className="flex flex-col gap-1 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="flex items-center justify-between gap-2">
                <span className="font-semibold">{p.title}</span>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold capitalize dark:bg-zinc-800">{p.status}</span>
              </p>
              <p className="text-sm">
                Claimed {p.claimed} · Redeemed {p.redeemed} · Expired {p.expired} · Conversion {p.conversion === null ? "–" : `${p.conversion}%`}
              </p>
            </li>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">Latest redemptions</h2>
        {report.recent.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">None yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Perk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {report.recent.map((r) => (
                  <tr key={r.code}>
                    <td className="whitespace-nowrap px-3 py-2">{time.format(r.redeemedAt)}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono">{r.code}</td>
                    <td className="px-3 py-2">{r.perkTitle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
