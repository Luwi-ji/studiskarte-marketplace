import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { escapeLike } from "@/lib/discovery/filters";
import { parseSearch } from "./users";

export const POSTS_PAGE_SIZE = 25;

/** The values of the `post_status` check in the schema, as a filter. */
export const POST_STATUSES = ["open", "reserved", "hidden", "removed", "withdrawn", "expired", "fulfilled"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];
export type PostStatusFilter = PostStatus | "all";

/** Reads `?status=`: one of the post statuses; anything else is "all". */
export function parseStatus(raw: string | string[] | undefined): PostStatusFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (POST_STATUSES as readonly string[]).includes(value ?? "") ? (value as PostStatus) : "all";
}

/** One post as the owner sees it in the list. No email, message or description is ever read. */
export type AdminPostRow = {
  id: string;
  title: string;
  kind: string;
  status: string;
  ownerHandle: string | null;
  ownerName: string;
  createdAt: Date;
  openReportCount: number;
};

export type AdminPostsPage = {
  /** The search as applied: trimmed, without a leading @, cut to the maximum length. Empty means every post. */
  search: string;
  status: PostStatusFilter;
  /** The page shown, 1-based, after fitting the request into the pages that exist. */
  page: number;
  totalPages: number;
  total: number;
  rows: AdminPostRow[];
};

type CountRow = { total: number };
type PageRow = {
  id: string;
  title: string;
  kind: string;
  status: string;
  handle: string | null;
  owner_name: string;
  created_at: Date | string;
  open_reports: number;
};

/**
 * One page of posts, newest first, optionally filtered by status and by a search that matches part of the
 * title, the owner's handle or the owner's display name. The search is plain text: `%`, `_` and `\` in it
 * match themselves. A page past the last one gives the last.
 */
export async function listAdminPosts(options: { search?: string | string[]; status?: string | string[]; page?: number }): Promise<AdminPostsPage> {
  const db = getDb();
  const search = parseSearch(options.search);
  const status = parseStatus(options.status);
  const like = `%${escapeLike(search)}%`;
  const searchFilter = search === "" ? sql`true` : sql`(p.title ilike ${like} or s.handle ilike ${like} or s.name ilike ${like})`;
  const statusFilter = status === "all" ? sql`true` : sql`p.status = ${status}`;

  const counted = await db.execute<CountRow>(sql`
    select count(*)::int as total from post p join student s on s.id = p.owner_id where ${searchFilter} and ${statusFilter}
  `);
  const total = counted.rows[0].total;
  const totalPages = Math.max(1, Math.ceil(total / POSTS_PAGE_SIZE));
  const page = Math.min(Math.max(Math.floor(options.page ?? 1) || 1, 1), totalPages);

  const result = await db.execute<PageRow>(sql`
    with page as (
      select p.id, p.title, p.kind, p.status, p.created_at, s.handle, s.name as owner_name
        from post p
        join student s on s.id = p.owner_id
       where ${searchFilter} and ${statusFilter}
       order by p.created_at desc, p.id
       limit ${POSTS_PAGE_SIZE} offset ${(page - 1) * POSTS_PAGE_SIZE}
    ),
    reports as (
      select r.post_id as id, count(*)::int as n
        from report r where r.status = 'open' and r.post_id in (select id from page) group by 1
    )
    select page.id, page.title, page.kind, page.status, page.created_at, page.handle, page.owner_name,
           coalesce(reports.n, 0) as open_reports
      from page
      left join reports on reports.id = page.id
     order by page.created_at desc, page.id
  `);

  return {
    search,
    status,
    page,
    totalPages,
    total,
    rows: result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      kind: row.kind,
      status: row.status,
      ownerHandle: row.handle,
      ownerName: row.owner_name,
      createdAt: new Date(row.created_at),
      openReportCount: row.open_reports,
    })),
  };
}
