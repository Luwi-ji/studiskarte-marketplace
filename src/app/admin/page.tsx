import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/access";
import {
  ACCOUNT_ROLES,
  ACCOUNT_STATUSES,
  getOverview,
  LISTING_KINDS,
  type Overview,
} from "@/lib/admin/overview";
import { PERIOD_OPTIONS, parsePeriodDays, type DailyPoint } from "@/lib/admin/series";
import { ROLE_LABEL, type Role } from "@/lib/identity/roles";
import { DataTable, dayLabel, formatCount, formatShare, Section, Stat, TrendCard, type ChartPart } from "./admin-ui";

export const metadata = { title: "Overview · Admin · Studiskarte Marketplace" };

const ROLE_PARTS: ChartPart<Role>[] = [
  { key: "student", label: ROLE_LABEL.student, color: "text-brand" },
  { key: "faculty", label: "Faculty", color: "text-emerald-500" },
  { key: "staff", label: ROLE_LABEL.staff, color: "text-violet-500" },
  { key: "alumni", label: ROLE_LABEL.alumni, color: "text-gold" },
  { key: "visitor", label: ROLE_LABEL.visitor, color: "text-rose-500" },
];
const STATUS_PARTS: ChartPart<(typeof ACCOUNT_STATUSES)[number]>[] = [
  { key: "active", label: "Active", color: "text-emerald-500" },
  { key: "suspended", label: "Suspended", color: "text-gold" },
  { key: "deleted", label: "Deleted", color: "text-zinc-400" },
];
const KIND_PARTS: ChartPart<(typeof LISTING_KINDS)[number]>[] = [
  { key: "showcase", label: "Showcase", color: "text-brand" },
  { key: "wishlist", label: "Wishlist", color: "text-gold" },
];
const single = (label: string, color = "text-brand"): ChartPart<"all">[] => [{ key: "all", label, color }];

export default function OverviewPage({ searchParams }: PageProps<"/admin">) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Overview</h1>
      <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** What one key of a daily chart added up to over the period. */
function partTotal<K extends string>(points: DailyPoint<K>[], key: K): number {
  return points.reduce((total, point) => total + point.parts[key], 0);
}

async function Dashboard({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  await requireAdmin();
  const days = parsePeriodDays((await searchParams).days);
  const o = await getOverview({ days });
  const stars = o.reviews.averageStars;

  return (
    <div className="flex flex-col gap-8">
      <PeriodSwitch current={o.period} />

      <Section title="People">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Accounts" value={formatCount(o.accounts.total)} caption="Everyone who has ever signed up, including suspended and deleted accounts." />
          <Stat label="Active accounts" value={formatCount(o.accounts.byStatus.active)} caption="People who can sign in right now." />
          <Stat label="New in this period" value={formatCount(o.accounts.newInPeriod)} caption={`Accounts created in the last ${o.period.days} days.`} />
          <Stat label="Suspended or deleted" value={formatCount(o.accounts.byStatus.suspended + o.accounts.byStatus.deleted)} caption="Suspended by you, or deleted by the person." />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <TrendCard
            title="New accounts per day"
            value={formatCount(o.accounts.newInPeriod)}
            caption="Accounts created each day, split by who they are."
            points={o.accounts.dailyByRole}
            parts={ROLE_PARTS}
          />
          <TrendCard
            title="New accounts by status"
            value={formatCount(o.accounts.newInPeriod)}
            caption="The same new accounts, split by what state they are in today."
            points={o.accounts.dailyByStatus}
            parts={STATUS_PARTS}
          />
          <DataTable
            caption="Accounts by role"
            head={["Role", "All time", "New in period"]}
            rows={ACCOUNT_ROLES.map((role) => [ROLE_LABEL[role], formatCount(o.accounts.byRole[role]), formatCount(partTotal(o.accounts.dailyByRole, role))])}
          />
          <DataTable
            caption="Accounts by status"
            head={["Status", "All time", "New in period"]}
            rows={ACCOUNT_STATUSES.map((status) => [
              STATUS_PARTS.find((p) => p.key === status)?.label ?? status,
              formatCount(o.accounts.byStatus[status]),
              formatCount(partTotal(o.accounts.dailyByStatus, status)),
            ])}
          />
          <DataTable caption="Schools with the most accounts" head={["School", "Accounts"]} rows={o.schools.byAccounts.map((row) => [row.name ?? row.id, formatCount(row.count)])} empty="No school accounts yet." />
          <DataTable caption="Schools with the most listings" head={["School", "Listings"]} rows={o.schools.byListings.map((row) => [row.name ?? row.id, formatCount(row.count)])} empty="No listings yet." />
        </div>
      </Section>

      <Section title="Listings">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Active listings now" value={formatCount(o.listings.activeNow)} caption="Open or reserved posts that people can see." />
          <Stat label="Created in this period" value={formatCount(o.listings.createdInPeriod)} caption="Showcase and Wishlist posts made, whatever happened to them later." />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <TrendCard
            title="Listings created per day"
            value={formatCount(o.listings.createdInPeriod)}
            caption="Showcase posts offer something; Wishlist posts ask for something."
            points={o.listings.dailyByKind}
            parts={KIND_PARTS}
          />
          <DataTable
            caption="Listings created in this period, by category (top 10)"
            head={["Category", "Listings"]}
            rows={o.listings.byCategory.map((row) => [row.name ?? row.id, formatCount(row.count)])}
            empty="No listings in this period."
          />
        </div>
      </Section>

      <Section title="Talk, offers and deals">
        <div className="grid gap-3 md:grid-cols-2">
          <TrendCard
            title="Conversations started"
            value={formatCount(o.conversations.startedInPeriod)}
            caption="New chats between two people. A chat counts once, on the day it began."
            points={o.conversations.daily}
            parts={single("conversations")}
          />
          <TrendCard
            title="Offers made"
            value={formatCount(o.offers.madeInPeriod)}
            caption="Offers and reserve requests sent on listings."
            points={o.offers.daily}
            parts={single("offers", "text-violet-500")}
          />
          <TrendCard
            title="Reservations made"
            value={formatCount(o.reservations.madeInPeriod)}
            caption="Offers that the listing's owner accepted: someone is now arranging a handover."
            points={o.reservations.daily}
            parts={single("reservations", "text-emerald-500")}
          />
          <TrendCard
            title="Deals completed"
            value={formatCount(o.deals.completedInPeriod)}
            caption="Handovers that both people confirmed, counted on the day the second one confirmed."
            points={o.deals.daily}
            parts={single("deals completed", "text-gold")}
          />
          <TrendCard
            title="Reviews given"
            value={formatCount(o.reviews.givenInPeriod)}
            caption="Reviews are written after a completed deal, one from each person."
            points={o.reviews.daily}
            parts={single("reviews", "text-rose-500")}
          />
          <Stat label="Average stars" value={stars === null ? "–" : `${stars.toFixed(2)} / 5`} caption="The average rating of the reviews given in this period." />
        </div>
      </Section>

      <Section title="How well it works">
        <HealthStats health={o.health} />
      </Section>

      <p className="text-xs text-zinc-500">
        Every number is counted from our own database. Days are Manila days, from {dayLabel(o.period.from)} to {dayLabel(o.period.to)}; today is still going.
      </p>
    </div>
  );
}

function HealthStats({ health }: { health: Overview["health"] }) {
  const { listingsWithMessage, reservationsCompleted, medianHoursToFirstMessage } = health;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <Stat
        label="Listings that got a message"
        value={formatShare(listingsWithMessage)}
        caption={`${formatCount(listingsWithMessage.numerator)} of ${formatCount(listingsWithMessage.denominator)} listings were messaged or offered on within 7 days. Only listings at least 7 days old are counted.`}
      />
      <Stat
        label="Reservations that completed"
        value={formatShare(reservationsCompleted)}
        caption={`${formatCount(reservationsCompleted.numerator)} of ${formatCount(reservationsCompleted.denominator)} reservations made in this period ended in a completed handover. Ones still being arranged are not counted.`}
      />
      <Stat
        label="Median wait for a first message"
        value={medianHoursToFirstMessage === null ? "–" : `${medianHoursToFirstMessage} h`}
        caption="Typical hours from a listing going up to the first message or offer on it, among listings at least 7 days old that got one."
      />
    </div>
  );
}

function PeriodSwitch({ current }: { current: Overview["period"] }) {
  return (
    <nav aria-label="Period" className="flex flex-wrap items-center gap-2">
      {PERIOD_OPTIONS.map((days) => (
        <Link
          key={days}
          href={`/admin?days=${days}`}
          aria-current={days === current.days ? "true" : undefined}
          className={`flex h-9 items-center rounded-full border px-4 text-sm ${days === current.days ? "border-transparent bg-brand font-medium text-white" : "border-zinc-300 dark:border-zinc-700"}`}
        >
          Last {days} days
        </Link>
      ))}
      <span className="text-xs text-zinc-500">
        {dayLabel(current.from)} – {dayLabel(current.to)}
      </span>
    </nav>
  );
}
