import { Suspense } from "react";
import Link from "next/link";
import { NotificationBell } from "@/components/notification-bell";
import { PageHeader } from "@/components/page-header";
import { PostGrid } from "@/components/post-grid";
import { requireActiveStudent } from "@/lib/access";
import { listFeed } from "@/lib/discovery/feed";
import { activeFilterCount, firstValues, parseFilters } from "@/lib/discovery/filters";
import { filterOptions } from "@/lib/discovery/page-data";
import { FilterSheet } from "../feed/filter-sheet";
import { MoreCards } from "../feed/more-cards";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <PageHeader title="Studiskarte" logo action={<NotificationBell />} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-3">
        <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
          <Feed searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Feed({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireActiveStudent();
  const raw = await searchParams;
  const params = firstValues(raw);
  const filters = parseFilters(raw);
  const [{ items, nextCursor }, options] = await Promise.all([listFeed(me.id, { filters }), filterOptions()]);
  const active = activeFilterCount(filters) + (filters.sort === "newest" ? 0 : 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Link
          href="/search"
          className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-zinc-300 px-3 text-zinc-500 dark:border-zinc-700"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <span className="truncate">Search</span>
        </Link>
        <FilterSheet action="/" categories={options.categories} schools={options.schools} values={params} keep={{}} activeCount={active} />
      </div>

      {items.length === 0 ? (
        active > 0 ? (
          <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">No posts match these filters.</p>
            <Link href="/" className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 font-medium dark:border-zinc-700">
              Clear filters
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">Nothing posted yet. Be the first.</p>
            <Link href="/posts/new" className="flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white">
              Create a post
            </Link>
          </div>
        )
      ) : (
        <>
          <PostGrid items={items} />
          <MoreCards key={JSON.stringify(params)} params={params} nextCursor={nextCursor} />
        </>
      )}
    </div>
  );
}
