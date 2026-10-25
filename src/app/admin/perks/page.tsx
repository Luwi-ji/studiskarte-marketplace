import { Suspense } from "react";
import { requireAdmin } from "@/lib/access";
import { listPartnersWithPerks, recentRedemptions, schoolDomainsForForm } from "@/lib/admin/perks";
import { limitLine } from "@/lib/perks/kinds";
import { formatDate, formatDateTime } from "../admin-ui";
import { AddPartnerForm } from "./partner-form";
import { PartnerCard, type PartnerCardData } from "./partner-card";

export const metadata = { title: "Perks · Admin · Studiskarte Marketplace" };

export default function PerksAdminPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Perks</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Add a shop, give it a perk, and students see it on the Perks page. At the shop the cashier types the shop PIN on the student&apos;s phone. Send each shop its report link to see its own numbers.
      </p>
      <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}

/** YYYY-MM-DD of a moment, as the Manila calendar shows it (what the date field takes). */
function manilaDay(date: Date): string {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function Content() {
  await requireAdmin();
  const [partners, redemptions, schools] = await Promise.all([listPartnersWithPerks(), recentRedemptions(20), schoolDomainsForForm()]);

  const cards: PartnerCardData[] = partners.map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    area: p.area,
    schools: p.schoolDomains ? p.schoolDomains.join(", ") : "Every school",
    status: p.status,
    pin: p.pin,
    reportPath: p.reportToken ? `/partner/${p.reportToken}` : null,
    perks: p.perks.map((x) => ({
      id: x.id,
      title: x.title,
      terms: x.terms,
      status: x.status,
      limit: limitLine(x.limitPerStudent, x.limitPeriod),
      totalQuantity: x.totalQuantity,
      endsOn: x.endsAt ? manilaDay(x.endsAt) : "",
      endsLabel: x.endsAt ? formatDate(x.endsAt) : null,
      claimed: x.claimed,
      redeemed: x.redeemed,
      expired: x.expired,
      conversion: x.conversion,
    })),
  }));

  return (
    <>
      <AddPartnerForm schools={schools} />
      {cards.length === 0 ? <p className="text-sm text-zinc-500">No partners yet.</p> : cards.map((card) => <PartnerCard key={card.id} partner={card} />)}

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Recent redemptions</h2>
        {redemptions.length === 0 ? (
          <p className="text-sm text-zinc-500">None yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Student</th>
                  <th className="px-3 py-2 font-medium">Perk</th>
                  <th className="px-3 py-2 font-medium">Shop</th>
                  <th className="px-3 py-2 font-medium">Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {redemptions.map((r) => (
                  <tr key={`${r.code}-${r.redeemedAt.getTime()}`}>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(r.redeemedAt)}</td>
                    <td className="px-3 py-2">{r.handle ? `@${r.handle}` : "(deleted account)"}</td>
                    <td className="px-3 py-2">{r.perkTitle}</td>
                    <td className="px-3 py-2">{r.partnerName}</td>
                    <td className="px-3 py-2 font-mono">{r.code}</td>
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
