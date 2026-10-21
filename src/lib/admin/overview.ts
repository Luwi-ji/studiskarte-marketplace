import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { SCHOOL_ROLES, type Role } from "@/lib/identity/roles";
import { fillDays, MANILA_TIME_ZONE, periodEnding, ratio, type DailyPoint, type PeriodDays, type Ratio } from "./series";

// Everything here is an aggregate over our own database: counts, shares and averages. No row of
// a person, a message or a listing is read, and nothing leaves the database but numbers.

export const ACCOUNT_ROLES = [...SCHOOL_ROLES, "visitor"] as const satisfies readonly Role[];
export const ACCOUNT_STATUSES = ["active", "suspended", "deleted"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export const LISTING_KINDS = ["showcase", "wishlist"] as const;
export type ListingKind = (typeof LISTING_KINDS)[number];

/** A listing needs this long to have a fair chance of a first message, so younger ones are left out of the shares. */
export const FIRST_MESSAGE_WINDOW_DAYS = 7;
/** How many schools and categories the top lists show. */
export const TOP_LIMIT = 10;

export type NamedCount = { id: string; name: string | null; count: number };

export type Overview = {
  period: { days: PeriodDays; from: string; to: string };
  accounts: {
    total: number;
    byRole: Record<Role, number>;
    byStatus: Record<AccountStatus, number>;
    newInPeriod: number;
    dailyByRole: DailyPoint<Role>[];
    dailyByStatus: DailyPoint<AccountStatus>[];
  };
  /** Schools by number of accounts and by number of listings, all time. Name is null until the owner names the school. */
  schools: { byAccounts: NamedCount[]; byListings: NamedCount[] };
  listings: {
    /** Open or reserved right now. */
    activeNow: number;
    createdInPeriod: number;
    dailyByKind: DailyPoint<ListingKind>[];
    /** Listings created in the period, by category. */
    byCategory: NamedCount[];
  };
  conversations: { startedInPeriod: number; daily: DailyPoint<"all">[] };
  offers: { madeInPeriod: number; daily: DailyPoint<"all">[] };
  /** A reservation is a deal: an offer the owner of the listing accepted. */
  reservations: { madeInPeriod: number; daily: DailyPoint<"all">[] };
  deals: { completedInPeriod: number; daily: DailyPoint<"all">[] };
  reviews: { givenInPeriod: number; averageStars: number | null; daily: DailyPoint<"all">[] };
  health: {
    /** Of the listings old enough to judge, those that got a first message within a week. */
    listingsWithMessage: Ratio;
    /** Of the reservations made in the period that have ended, those that completed. */
    reservationsCompleted: Ratio;
    /** Median hours from a listing going up to its first message; null when none of them got one. */
    medianHoursToFirstMessage: number | null;
  };
};

type DailyRow = { metric: string; day: string; key: string; n: number };
type RoleStatusRow = { role: string; status: string; n: number };
type NamedRow = { id: string; name: string | null; n: number };
type StatsRow = {
  active_listings: number;
  reviews_given: number;
  review_average: number | null;
  deals_ended: number;
  deals_completed: number;
  cohort_listings: number;
  cohort_messaged: number;
  median_hours: number | null;
};

function toNamed(rows: NamedRow[]): NamedCount[] {
  return rows.map((row) => ({ id: row.id, name: row.name, count: row.n }));
}

/**
 * The owner's overview of the last `days` Manila days up to `now`: who signed up, what was listed,
 * how much of it led to talk, offers, reservations and reviews. Six queries, none per row.
 */
export async function getOverview(options: { days: PeriodDays; now?: Date }): Promise<Overview> {
  const db = getDb();
  const period = periodEnding(options.days, options.now ?? new Date());
  const from = period.startsAt.toISOString();
  const to = period.endsAt.toISOString();
  const bucket = (column: string) => sql`to_char((${sql.raw(column)} at time zone ${MANILA_TIME_ZONE})::date, 'YYYY-MM-DD')`;

  const [daily, roleStatus, byAccounts, byListings, byCategory, stats] = await Promise.all([
    db.execute<DailyRow>(sql`
      select 'accounts_role' as metric, ${bucket("created_at")} as day, role as key, count(*)::int as n
        from student where created_at >= ${from}::timestamptz and created_at < ${to}::timestamptz group by 2, 3
      union all
      select 'accounts_status', ${bucket("created_at")}, account_status, count(*)::int
        from student where created_at >= ${from}::timestamptz and created_at < ${to}::timestamptz group by 2, 3
      union all
      select 'listings', ${bucket("created_at")}, kind, count(*)::int
        from post where created_at >= ${from}::timestamptz and created_at < ${to}::timestamptz group by 2, 3
      union all
      select 'conversations', ${bucket("created_at")}, 'all', count(*)::int
        from conversation where created_at >= ${from}::timestamptz and created_at < ${to}::timestamptz group by 2
      union all
      select 'offers', ${bucket("created_at")}, 'all', count(*)::int
        from offer where created_at >= ${from}::timestamptz and created_at < ${to}::timestamptz group by 2
      union all
      select 'reservations', ${bucket("created_at")}, 'all', count(*)::int
        from deal where created_at >= ${from}::timestamptz and created_at < ${to}::timestamptz group by 2
      union all
      select 'deals_completed', ${bucket("greatest(owner_confirmed_at, responder_confirmed_at)")}, 'all', count(*)::int
        from deal
        where status = 'completed'
          and greatest(owner_confirmed_at, responder_confirmed_at) >= ${from}::timestamptz
          and greatest(owner_confirmed_at, responder_confirmed_at) < ${to}::timestamptz
        group by 2
      union all
      select 'reviews', ${bucket("created_at")}, 'all', count(*)::int
        from review where created_at >= ${from}::timestamptz and created_at < ${to}::timestamptz group by 2
    `),
    db.execute<RoleStatusRow>(sql`select role, account_status as status, count(*)::int as n from student group by 1, 2`),
    db.execute<NamedRow>(sql`
      select s.school_domain as id, sc.name, count(*)::int as n
        from student s join school sc on sc.domain = s.school_domain
        where s.account_status <> 'deleted'
        group by 1, 2 order by n desc, id limit ${TOP_LIMIT}
    `),
    db.execute<NamedRow>(sql`
      select s.school_domain as id, sc.name, count(*)::int as n
        from post p
        join student s on s.id = p.owner_id
        join school sc on sc.domain = s.school_domain
        group by 1, 2 order by n desc, id limit ${TOP_LIMIT}
    `),
    db.execute<NamedRow>(sql`
      select c.id, c.name, count(*)::int as n
        from post p join category c on c.id = p.category_id
        where p.created_at >= ${from}::timestamptz and p.created_at < ${to}::timestamptz
        group by 1, 2 order by n desc, c.name limit ${TOP_LIMIT}
    `),
    db.execute<StatsRow>(sql`
      with cohort as (
        select id, created_at from post
         where created_at >= ${from}::timestamptz
           and created_at < ${to}::timestamptz - make_interval(days => ${FIRST_MESSAGE_WINDOW_DAYS})
      ),
      first_message as (
        select cl.post_id, min(cl.created_at) as first_at
          from conversation_listing cl join cohort c on c.id = cl.post_id
         group by cl.post_id
      ),
      delay as (
        select f.first_at - c.created_at as took from first_message f join cohort c on c.id = f.post_id
      )
      select
        (select count(*)::int from post where status in ('open', 'reserved')) as active_listings,
        (select count(*)::int from review where created_at >= ${from}::timestamptz and created_at < ${to}::timestamptz) as reviews_given,
        (select avg(rating)::float8 from review where created_at >= ${from}::timestamptz and created_at < ${to}::timestamptz) as review_average,
        (select count(*)::int from deal
          where created_at >= ${from}::timestamptz and created_at < ${to}::timestamptz
            and status in ('completed', 'cancelled', 'disputed')) as deals_ended,
        (select count(*)::int from deal
          where created_at >= ${from}::timestamptz and created_at < ${to}::timestamptz
            and status = 'completed') as deals_completed,
        (select count(*)::int from cohort) as cohort_listings,
        (select count(*)::int from delay where took <= make_interval(days => ${FIRST_MESSAGE_WINDOW_DAYS})) as cohort_messaged,
        (select percentile_cont(0.5) within group (order by extract(epoch from took) / 3600.0) from delay) as median_hours
    `),
  ]);

  const series = <K extends string>(metric: string, keys: readonly K[]) =>
    fillDays(
      period.dayKeys,
      keys,
      daily.rows.filter((row) => row.metric === metric).map((row) => ({ day: row.day, key: row.key, n: row.n })),
    );
  const sum = (points: DailyPoint<string>[]) => points.reduce((total, point) => total + point.total, 0);

  const byRole = Object.fromEntries(ACCOUNT_ROLES.map((role) => [role, 0])) as Record<Role, number>;
  const byStatus = Object.fromEntries(ACCOUNT_STATUSES.map((status) => [status, 0])) as Record<AccountStatus, number>;
  for (const row of roleStatus.rows) {
    if (row.role in byRole) byRole[row.role as Role] += row.n;
    if (row.status in byStatus) byStatus[row.status as AccountStatus] += row.n;
  }

  const dailyByRole = series("accounts_role", ACCOUNT_ROLES);
  const dailyByKind = series("listings", LISTING_KINDS);
  const dailyCompleted = series("deals_completed", ["all"]);
  const conversations = series("conversations", ["all"]);
  const offers = series("offers", ["all"]);
  const reservations = series("reservations", ["all"]);
  const reviews = series("reviews", ["all"]);
  const s = stats.rows[0];

  return {
    period: { days: period.days, from: period.dayKeys[0], to: period.dayKeys[period.dayKeys.length - 1] },
    accounts: {
      total: Object.values(byStatus).reduce((total, n) => total + n, 0),
      byRole,
      byStatus,
      newInPeriod: sum(dailyByRole),
      dailyByRole,
      dailyByStatus: series("accounts_status", ACCOUNT_STATUSES),
    },
    schools: { byAccounts: toNamed(byAccounts.rows), byListings: toNamed(byListings.rows) },
    listings: { activeNow: s.active_listings, createdInPeriod: sum(dailyByKind), dailyByKind, byCategory: toNamed(byCategory.rows) },
    conversations: { startedInPeriod: sum(conversations), daily: conversations },
    offers: { madeInPeriod: sum(offers), daily: offers },
    reservations: { madeInPeriod: sum(reservations), daily: reservations },
    deals: { completedInPeriod: sum(dailyCompleted), daily: dailyCompleted },
    reviews: {
      givenInPeriod: s.reviews_given,
      averageStars: s.review_average === null ? null : Math.round(s.review_average * 100) / 100,
      daily: reviews,
    },
    health: {
      listingsWithMessage: ratio(s.cohort_messaged, s.cohort_listings),
      reservationsCompleted: ratio(s.deals_completed, s.deals_ended),
      medianHoursToFirstMessage: s.median_hours === null ? null : Math.round(s.median_hours * 10) / 10,
    },
  };
}
