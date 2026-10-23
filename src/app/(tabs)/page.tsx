import { Suspense } from "react";
import { NewPostButton } from "@/components/post-chooser";
import { FeedHeader, type FeedNav } from "@/components/feed-header";
import { NotificationBell } from "@/components/notification-bell";
import { PostGrid } from "@/components/post-grid";
import { CardGridSkeleton } from "@/components/skeletons";
import { PendingLink, PendingNav, PendingResults } from "@/components/pending-nav";
import { HeaderSheets } from "@/components/header-sheets";
import { requireActiveStudent } from "@/lib/access";
import { FirstRunStrip } from "@/components/first-run-strip";
import { listFeed } from "@/lib/discovery/feed";
import { hasStarted } from "@/lib/discovery/started";
import { getOwnProfile } from "@/lib/identity/profile";
import { activeFilterCount, firstValues, parseFilters, toSearchParams } from "@/lib/discovery/filters";
import { filterOptions } from "@/lib/discovery/page-data";
import { MoreCards } from "../feed/more-cards";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <PendingNav>
      <HeaderSheets action="/">
        <Suspense
          fallback={
            <>
              <FeedHeader bell={<NotificationBell />} />
              <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-3">
                <CardGridSkeleton />
              </main>
            </>
          }
        >
          <Feed searchParams={searchParams} />
        </Suspense>
      </HeaderSheets>
    </PendingNav>
  );
}

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

  // The tab strip highlights one tab: the kind if one is set, else the school scope.
  const kind = filters.kind;
  const nav: FeedNav = {
    tabs: [
      ...(me.schoolDomain ? [{ id: "mine", label: "My school", href: hrefWith({ school: me.schoolDomain, kind: undefined }), current: !kind && mine }] : []),
      { id: "all", label: "All schools", href: hrefWith({ school: undefined, kind: undefined }), current: !kind && chosenSchools.length === 0 },
      { id: "showcase", label: "Showcase", href: hrefWith({ kind: "showcase" }), current: kind === "showcase" },
      { id: "wishlist", label: "Wishlist", href: hrefWith({ kind: "wishlist" }), current: kind === "wishlist" },
    ],
    schoolChip: otherSchools ? { id: "school", label: otherLabel, href: hrefWith({ school: undefined }), current: !kind } : null,
    filters: { options, activeCount: active },
  };

  return (
    <>
      <FeedHeader bell={<NotificationBell />} nav={nav} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-3">
        <div className="flex flex-col gap-3">
          {showStrip ? <FirstRunStrip studentId={me.id} displayName={profile?.displayName || me.handle} canSell={me.role === "student"} /> : null}
          <PendingResults skeleton={<CardGridSkeleton />} className="flex flex-col gap-3">
            {items.length === 0 ? (
              mine && active === 1 ? (
                <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
                  <p className="text-zinc-600 dark:text-zinc-400">No one at {profile?.school ?? "your school"} has posted yet. Be the first, or look at all schools.</p>
                  <NewPostButton canSell={me.role === "student"} className="flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white">
                    Post an item
                  </NewPostButton>
                  <PendingLink href={hrefWith({ school: undefined })} id="all" className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 font-medium dark:border-zinc-700">
                    All schools
                  </PendingLink>
                </div>
              ) : active > 0 ? (
                <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
                  <p className="text-zinc-600 dark:text-zinc-400">No posts match these filters.</p>
                  <PendingLink href="/" className="flex h-11 items-center rounded-lg border border-zinc-300 px-4 font-medium dark:border-zinc-700">
                    Clear filters
                  </PendingLink>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
                  <p className="text-zinc-600 dark:text-zinc-400">
                    {profile ? `Nothing posted yet, not even at ${profile.school}. Be the first.` : "Nothing posted yet. Be the first."}
                  </p>
                  <NewPostButton canSell={me.role === "student"} className="flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white">
                    Create a post
                  </NewPostButton>
                </div>
              )
            ) : (
              <>
                <PostGrid items={items} />
                <MoreCards key={JSON.stringify(params)} params={params} nextCursor={nextCursor} />
              </>
            )}
          </PendingResults>
        </div>
      </main>
    </>
  );
}
