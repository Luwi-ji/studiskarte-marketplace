import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { escapeLike } from "@/lib/discovery/filters";

export const USERS_PAGE_SIZE = 25;
/** A longer search is cut here; no handle, name or email is longer. */
export const USER_SEARCH_MAX_LENGTH = 100;
/** A page number past this is treated as this; it keeps OFFSET arithmetic far from overflow. */
const MAX_PAGE = 1_000_000;

/**
 * One account as the owner sees it. The email is shown because the owner runs the service; no message,
 * password, session or address of the device is ever read here.
 */
export type UserRow = {
  id: string;
  handle: string | null;
  displayName: string;
  email: string;
  schoolDomain: string | null;
  schoolName: string | null;
  role: string;
  accountStatus: string;
  isAdmin: boolean;
  createdAt: Date;
  /** Every listing the account has made, whatever happened to it since. */
  listings: number;
  /** Reports made about the account itself (not about its listings). */
  reportsAgainst: number;
  openReportsAgainst: number;
};

export type UsersPage = {
  /** The search as it was applied: trimmed, without a leading @, cut to the maximum length. Empty means everyone. */
  search: string;
  /** The page shown, 1-based, after fitting the request into the pages that exist. */
  page: number;
  totalPages: number;
  total: number;
  rows: UserRow[];
};

/** Reads `?page=`: a whole number from 1; anything else is page 1. */
export function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || !/^\d{1,7}$/.test(value)) return 1;
  return Math.min(Math.max(Number(value), 1), MAX_PAGE);
}

/** Reads `?q=`: trimmed, a leading @ dropped (handles are written with one), cut to the maximum length. */
export function parseSearch(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim().replace(/^@/, "").slice(0, USER_SEARCH_MAX_LENGTH).trim();
}

type CountRow = { total: number };
type PageRow = {
  id: string;
  handle: string | null;
  name: string;
  email: string;
  school_domain: string | null;
  school_name: string | null;
  role: string;
  account_status: string;
  is_admin: boolean;
  created_at: Date | string;
  listings: number;
  reports_against: number;
  open_reports_against: number;
};

/**
 * One page of accounts, newest first, optionally filtered by a search that matches part of the handle,
 * display name or email. The search is plain text: `%`, `_` and `\` in it match themselves. A page past the
 * last one gives the last. Listing and report counts are aggregated once for the 25 rows of the page.
 */
export async function listUsers(options: { search?: string | string[]; page?: number }): Promise<UsersPage> {
  const db = getDb();
  const search = parseSearch(options.search);
  const like = `%${escapeLike(search)}%`;
  const filter =
    search === ""
      ? sql`true`
      : sql`(s.handle ilike ${like} or s.name ilike ${like} or s.email ilike ${like})`;

  const counted = await db.execute<CountRow>(sql`select count(*)::int as total from student s where ${filter}`);
  const total = counted.rows[0].total;
  const totalPages = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  const page = Math.min(Math.max(Math.floor(options.page ?? 1) || 1, 1), totalPages);

  const result = await db.execute<PageRow>(sql`
    with page as (
      select s.id, s.handle, s.name, s.email, s.school_domain, s.role, s.account_status, s.is_admin, s.created_at
        from student s
       where ${filter}
       order by s.created_at desc, s.id
       limit ${USERS_PAGE_SIZE} offset ${(page - 1) * USERS_PAGE_SIZE}
    ),
    listings as (
      select p.owner_id as id, count(*)::int as n from post p where p.owner_id in (select id from page) group by 1
    ),
    reports as (
      select r.student_id as id, count(*)::int as n, (count(*) filter (where r.status = 'open'))::int as open_n
        from report r where r.student_id in (select id from page) group by 1
    )
    select page.id, page.handle, page.name, page.email, page.school_domain, sc.name as school_name,
           page.role, page.account_status, page.is_admin, page.created_at,
           coalesce(listings.n, 0) as listings,
           coalesce(reports.n, 0) as reports_against,
           coalesce(reports.open_n, 0) as open_reports_against
      from page
      left join school sc on sc.domain = page.school_domain
      left join listings on listings.id = page.id
      left join reports on reports.id = page.id
     order by page.created_at desc, page.id
  `);

  return {
    search,
    page,
    totalPages,
    total,
    rows: result.rows.map((row) => ({
      id: row.id,
      handle: row.handle,
      displayName: row.name,
      email: row.email,
      schoolDomain: row.school_domain,
      schoolName: row.school_name,
      role: row.role,
      accountStatus: row.account_status,
      isAdmin: row.is_admin,
      createdAt: new Date(row.created_at),
      listings: row.listings,
      reportsAgainst: row.reports_against,
      openReportsAgainst: row.open_reports_against,
    })),
  };
}
