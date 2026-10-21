import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/access";
import { listUsers, parsePage, USER_SEARCH_MAX_LENGTH, USERS_PAGE_SIZE, type UserRow, type UsersPage } from "@/lib/admin/users";
import { ROLE_LABEL, type Role } from "@/lib/identity/roles";
import { AdminButton } from "../admin-buttons";
import { formatCount, formatDate } from "../admin-ui";

export const metadata = { title: "Users · Admin · Studiskarte Marketplace" };

export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Users</h1>
      <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
        <Accounts searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const button = "flex h-11 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700";

function pageHref(search: string, page: number): string {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
}

async function Accounts({ searchParams }: Pick<PageProps<"/admin/users">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const result = await listUsers({ search: params.q, page: parsePage(params.page) });

  return (
    <div className="flex flex-col gap-4">
      <form action="/admin/users" method="get" role="search" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={result.search}
          maxLength={USER_SEARCH_MAX_LENGTH}
          placeholder="Search handle, name or email"
          aria-label="Search handle, name or email"
          className="h-11 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 text-base dark:border-zinc-700"
        />
        <button type="submit" className="h-11 rounded-lg bg-brand px-4 text-base font-medium text-white">
          Search
        </button>
      </form>
      <p className="text-sm text-zinc-500">
        {formatCount(result.total)} {result.total === 1 ? "account" : "accounts"}
        {result.search ? ` matching “${result.search}”` : ""}, newest first. Emails are shown to you only.
      </p>
      <Table rows={result.rows} />
      <Pager result={result} />
    </div>
  );
}

function Table({ rows }: { rows: UserRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-zinc-500">No accounts found.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th className="px-3 py-2 font-medium">Account</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">School</th>
            <th className="px-3 py-2 font-medium">Role</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Joined</th>
            <th className="px-3 py-2 text-right font-medium">Listings</th>
            <th className="px-3 py-2 text-right font-medium">Reports against</th>
            <th className="px-3 py-2 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-t border-zinc-200 align-middle dark:border-zinc-800">
              <td className="px-3 py-2">
                {u.handle ? (
                  <Link href={`/u/${u.handle}`} className="font-medium underline">
                    @{u.handle}
                  </Link>
                ) : (
                  <span className="text-zinc-500">No handle yet</span>
                )}
                {u.displayName ? <span className="block max-w-48 truncate text-zinc-600 dark:text-zinc-400">{u.displayName}</span> : null}
              </td>
              <td className="max-w-56 truncate px-3 py-2">{u.email}</td>
              <td className="px-3 py-2">{u.schoolName ?? u.schoolDomain ?? "–"}</td>
              <td className="px-3 py-2">
                {ROLE_LABEL[u.role as Role] ?? u.role}
                {u.isAdmin ? <span className="block text-xs text-zinc-500">Admin</span> : null}
              </td>
              <td className="px-3 py-2 capitalize">{u.accountStatus}</td>
              <td className="whitespace-nowrap px-3 py-2">{formatDate(u.createdAt)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCount(u.listings)}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatCount(u.reportsAgainst)}
                {u.openReportsAgainst > 0 ? <span className="block text-xs text-red-600 dark:text-red-400">{u.openReportsAgainst} open</span> : null}
              </td>
              <td className="px-3 py-2">
                {u.accountStatus === "active" && !u.isAdmin ? (
                  <AdminButton compact kind="suspendStudent" id={u.id} label="Suspend" danger ask="required" confirm="Suspend this student? They are signed out everywhere and cannot sign in." />
                ) : null}
                {u.accountStatus === "suspended" ? <AdminButton compact kind="restoreStudent" id={u.id} label="Restore" /> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pager({ result }: { result: UsersPage }) {
  if (result.totalPages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3">
      {result.page > 1 ? (
        <Link href={pageHref(result.search, result.page - 1)} className={button}>
          ‹ Newer
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-zinc-500">
        Page {result.page} of {result.totalPages} · {USERS_PAGE_SIZE} per page
      </span>
      {result.page < result.totalPages ? (
        <Link href={pageHref(result.search, result.page + 1)} className={button}>
          Older ›
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
