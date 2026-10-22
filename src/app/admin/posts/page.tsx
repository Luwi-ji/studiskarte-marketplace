import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/access";
import { listAdminPosts, POST_STATUSES, POSTS_PAGE_SIZE, type AdminPostRow, type AdminPostsPage } from "@/lib/admin/posts";
import { parsePage, USER_SEARCH_MAX_LENGTH } from "@/lib/admin/users";
import { AdminButton } from "../admin-buttons";
import { formatCount, formatDate } from "../admin-ui";

export const metadata = { title: "Posts · Admin · Studiskarte Marketplace" };

export default function PostsPage({ searchParams }: PageProps<"/admin/posts">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Posts</h1>
      <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
        <Posts searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const button = "flex h-11 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700";

function pageHref(search: string, status: string, page: number): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/posts?${query}` : "/admin/posts";
}

async function Posts({ searchParams }: Pick<PageProps<"/admin/posts">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const result = await listAdminPosts({ search: params.q, status: params.status, page: parsePage(params.page) });

  return (
    <div className="flex flex-col gap-4">
      <form action="/admin/posts" method="get" role="search" className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          name="q"
          defaultValue={result.search}
          maxLength={USER_SEARCH_MAX_LENGTH}
          placeholder="Search title, owner handle or name"
          aria-label="Search title, owner handle or name"
          className="h-11 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 text-base dark:border-zinc-700"
        />
        <div className="flex gap-2">
          <select
            name="status"
            defaultValue={result.status}
            aria-label="Status"
            className="h-11 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 text-base capitalize dark:border-zinc-700"
          >
            <option value="all">All statuses</option>
            {POST_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <button type="submit" className="h-11 rounded-lg bg-brand px-4 text-base font-medium text-white">
            Search
          </button>
        </div>
      </form>
      <p className="text-sm text-zinc-500">
        {formatCount(result.total)} {result.total === 1 ? "post" : "posts"}
        {result.status !== "all" ? ` that are ${result.status}` : ""}
        {result.search ? ` matching “${result.search}”` : ""}, newest first.
      </p>
      <Table rows={result.rows} />
      <Pager result={result} />
    </div>
  );
}

function Table({ rows }: { rows: AdminPostRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-500">No posts found.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th className="px-3 py-2 font-medium">Post</th>
            <th className="px-3 py-2 font-medium">Kind</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Owner</th>
            <th className="px-3 py-2 font-medium">Posted</th>
            <th className="px-3 py-2 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-zinc-200 align-middle dark:border-zinc-800">
              <td className="px-3 py-2">
                <Link href={`/posts/${p.id}`} className="block max-w-64 truncate font-medium underline">
                  {p.title}
                </Link>
                {p.openReportCount > 0 ? (
                  <span className="block text-xs text-red-600 dark:text-red-400">
                    {p.openReportCount} open {p.openReportCount === 1 ? "report" : "reports"}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 capitalize">{p.kind}</td>
              <td className="px-3 py-2 capitalize">{p.status}</td>
              <td className="px-3 py-2">
                {p.ownerHandle ? (
                  <Link href={`/u/${p.ownerHandle}`} className="underline">
                    @{p.ownerHandle}
                  </Link>
                ) : (
                  <span className="text-zinc-500">No handle yet</span>
                )}
                {p.ownerName ? <span className="block max-w-48 truncate text-zinc-600 dark:text-zinc-400">{p.ownerName}</span> : null}
              </td>
              <td className="whitespace-nowrap px-3 py-2">{formatDate(p.createdAt)}</td>
              <td className="px-3 py-2">
                <div className="flex gap-2">
                  {p.status === "hidden" ? <AdminButton compact kind="restorePost" id={p.id} label="Restore" ask="optional" /> : null}
                  {p.status === "open" || p.status === "reserved" || p.status === "hidden" ? (
                    <AdminButton
                      compact
                      kind="removePost"
                      id={p.id}
                      label="Remove"
                      danger
                      ask="required"
                      confirm="Remove this post? Any reservation on it is ended and the owner is told, with your reason."
                    />
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pager({ result }: { result: AdminPostsPage }) {
  if (result.totalPages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3">
      {result.page > 1 ? (
        <Link href={pageHref(result.search, result.status, result.page - 1)} className={button}>
          ‹ Newer
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-zinc-500">
        Page {result.page} of {result.totalPages} · {POSTS_PAGE_SIZE} per page
      </span>
      {result.page < result.totalPages ? (
        <Link href={pageHref(result.search, result.status, result.page + 1)} className={button}>
          Older ›
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
