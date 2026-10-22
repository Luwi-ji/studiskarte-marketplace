import { Suspense } from "react";
import Link from "next/link";
import { NotificationBell } from "@/components/notification-bell";
import { PageHeader } from "@/components/page-header";
import { PostGrid } from "@/components/post-grid";
import { CardGridSkeleton } from "@/components/skeletons";
import { requireActiveStudent } from "@/lib/access";
import { FirstRunStrip } from "@/components/first-run-strip";
import { listFeed } from "@/lib/discovery/feed";
import { hasStarted } from "@/lib/discovery/started";
import { getOwnProfile } from "@/lib/identity/profile";
import { activeFilterCount, firstValues, parseFilters, toSearchParams } from "@/lib/discovery/filters";
import { filterOptions } from "@/lib/discovery/page-data";
import { FilterSheet } from "../feed/filter-sheet";
import { MoreCards } from "../feed/more-cards";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <PageHeader title="Studiskarte" logo action={<NotificationBell />} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-3">
        <Suspense fallback={<CardGridSkeleton />}>
          <Feed searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

const chipBase = "flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium active:opacity-80";
const chipOn = `${chipBase} border-brand bg-brand/10 text-brand-text`;
const chipOff = `${chipBase} border-zinc-300 dark:border-zinc-700`;

async function Feed({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireActiveStudent();
  const raw = await searchParams;
  const params = firstValues(raw);
  const filters = parseFilters(raw);
  const [{ items, nextCursor }, options, started, profile] = await Promise.all([
    listFeed(me.id, { filters }),
    filterOptions(me.id),
    hasStarted(me.id),
    getOwnProfile(me.id),
  ]);
  const showStrip = !started;
  const active = activeFilterCount(filters) + (filters.sort === "newest" ? 0 : 1);

  // Which school the feed shows, and which kind of post: one tap changes either, and the Filters button counts them.
  const hrefWith = (change: Record<string, string | undefined>) => {
    const qs = toSearchParams({ ...params, ...change });
    return qs ? `/?${qs}` : "/";
  };
  const chosenSchools = filters.school ?? [];
  const mine = me.schoolDomain !== null && chosenSchools.length === 1 && chosenSchools[0] === me.schoolDomain;
  const otherSchools = chosenSchools.length > 0 && !mine;
  const otherLabel = chosenSchools.length === 1 ? (options.schools.find((s) => s.id === chosenSchools[0])?.name ?? chosenSchools[0]) : `${chosenSchools.length} schools`;

  return (
    <div className="flex flex-col gap-3">
      {showStrip ? <FirstRunStrip studentId={me.id} displayName={profile?.displayName || me.handle} /> : null}
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

      <nav aria-label="Show posts from" className="-mx-3 flex gap-2 overflow-x-auto px-3">
        {me.schoolDomain ? (
          <Link href={hrefWith({ school: me.schoolDomain })} aria-current={mine ? "true" : undefined} className={mine ? chipOn : chipOff}>
            My school
          </Link>
        ) : null}
        <Link href={hrefWith({ school: undefined })} aria-current={chosenSchools.length === 0 ? "true" : undefined} className={chosenSchools.length === 0 ? chipOn : chipOff}>
          All schools
        </Link>
        {otherSchools ? (
          <Link href={hrefWith({ school: undefined })} aria-current="true" className={`${chipOn} max-w-56`}>
            <span className="truncate">{otherLabel}</span>
            <span aria-hidden className="ml-2">×</span>
            <span className="sr-only">, show all schools</span>
          </Link>
        ) : null}
        <span aria-hidden className="my-2 w-px shrink-0 bg-zinc-200 dark:bg-zinc-800" />
        <Link href={hrefWith({ kind: filters.kind === "showcase" ? undefined : "showcase" })} aria-current={filters.kind === "showcase" ? "true" : undefined} className={filters.kind === "showcase" ? chipOn : chipOff}>
          Showcase
        </Link>
        <Link href={hrefWith({ kind: filters.kind === "wishlist" ? undefined : "wishlist" })} aria-current={filters.kind === "wishlist" ? "true" : undefined} className={filters.kind === "wishlist" ? chipOn : chipOff}>
          Wishlist
        </Link>
      </nav>

      {items.length === 0 ? (
        mine && active === 1 ? (
          <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">No one at {profile?.school ?? "your school"} has posted yet. Be the first, or look at all schools.</p>
            <Link href="/posts/new" className="flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white">
              Post an item
            </Link>
            <Link href={hrefWith({ school: undefined })} className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 font-medium dark:border-zinc-700">
              All schools
            </Link>
          </div>
        ) : active > 0 ? (
          <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">No posts match these filters.</p>
            <Link href="/" className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 font-medium dark:border-zinc-700">
              Clear filters
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">
              {profile ? `Nothing posted yet, not even at ${profile.school}. Be the first.` : "Nothing posted yet. Be the first."}
            </p>
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
