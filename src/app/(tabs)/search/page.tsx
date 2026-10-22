import { Suspense } from "react";
import Link from "next/link";
import { SearchHeader, type SearchNav } from "@/components/search-header";
import { PostGrid } from "@/components/post-grid";
import { CardGridSkeleton } from "@/components/skeletons";
import { VerifiedBadge } from "@/components/verified-badge";
import { requireActiveStudent } from "@/lib/access";
import { listFeed } from "@/lib/discovery/feed";
import { activeFilterCount, firstValues, parseFilters, toSearchParams } from "@/lib/discovery/filters";
import { filterOptions } from "@/lib/discovery/page-data";
import { searchPeople, searchSchools } from "@/lib/discovery/search";
import { getObjectStore } from "@/lib/images/store";
import { MoreCards } from "../../feed/more-cards";

export const metadata = { title: "Search · Studiskarte Marketplace" };

const TABS = [
  { id: "posts", label: "Posts" },
  { id: "people", label: "People" },
  { id: "schools", label: "Schools" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const AVATAR_LINK_SECONDS = 5 * 60;

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Suspense
      fallback={
        <>
          <SearchHeader enter />
          <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-3 transition-opacity duration-150 ease-out starting:opacity-0 motion-reduce:transition-none">
            <CardGridSkeleton />
          </main>
        </>
      }
    >
      <Search searchParams={searchParams} />
    </Suspense>
  );
}

function Hint({ children }: { children: string }) {
  return <p className="px-6 py-12 text-center text-zinc-500">{children}</p>;
}

/** Before anything is typed: what to type. Categories live in the header's menu. */
function SearchStart() {
  return <Hint>Search posts, people or schools.</Hint>;
}

async function Search({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireActiveStudent();
  const raw = await searchParams;
  const params = firstValues(raw);
  const filters = parseFilters(raw);
  const q = filters.query ?? "";
  const tab: TabId = TABS.find((t) => t.id === params.tab)?.id ?? "posts";

  const options = await filterOptions(me.id);
  const active = activeFilterCount(filters) + (filters.sort === "newest" ? 0 : 1);

  // Choosing a category stays on Search: keep the query and the other filters, show Posts.
  const categoryHref = (category: string | undefined) => `/search?${toSearchParams({ ...params, q, tab: "posts", category })}`;
  const chosenCategories = filters.category ?? [];
  const nav: SearchNav = {
    tabs: TABS.map((t) => ({
      id: t.id,
      label: t.label,
      href: `/search?${toSearchParams({ ...(t.id === "posts" ? params : { q }), tab: t.id })}`,
      current: t.id === tab,
    })),
    categories: {
      allHref: categoryHref(undefined),
      allCurrent: chosenCategories.length === 0,
      items: options.categories.map((c) => ({ id: c.id, name: c.name, href: categoryHref(c.id), current: chosenCategories.includes(c.id) })),
    },
    filters:
      tab === "posts"
        ? { categories: options.categories, schools: options.schools, values: params, keep: { q, tab: "posts" }, activeCount: active }
        : null,
  };

  return (
    <>
      <SearchHeader nav={nav} q={q} tab={tab} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-3">
        {q === "" ? (
          <SearchStart />
        ) : tab === "posts" ? (
          <PostResults meId={me.id} params={params} q={q} />
        ) : tab === "people" ? (
          <PeopleResults meId={me.id} q={q} />
        ) : (
          <SchoolResults meId={me.id} q={q} />
        )}
      </main>
    </>
  );
}

async function PostResults({ meId, params, q }: { meId: string; params: Record<string, string>; q: string }) {
  const filters = parseFilters(params);
  if (filters.terms.length === 0) return <Hint>Type at least 2 letters.</Hint>;
  const { items, nextCursor } = await listFeed(meId, { filters });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">Newest first unless you choose another sort.</p>
      {items.length === 0 ? (
        <Hint>{`No posts found for “${q}”.`}</Hint>
      ) : (
        <>
          <PostGrid items={items} />
          <MoreCards key={JSON.stringify(params)} params={params} nextCursor={nextCursor} />
        </>
      )}
    </div>
  );
}

async function PeopleResults({ meId, q }: { meId: string; q: string }) {
  const people = await searchPeople(meId, q);
  if (people.length === 0) return <Hint>{q.replace("@", "").length < 2 ? "Type at least 2 letters." : `No one found for “${q}”.`}</Hint>;
  const store = getObjectStore();
  const pictures = await Promise.all(people.map((p) => (p.avatarThumbKey ? store.signedUrl(p.avatarThumbKey, AVATAR_LINK_SECONDS) : null)));

  return (
    <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
      {people.map((person, index) => (
        <li key={person.handle}>
          <Link href={`/u/${person.handle}`} className="flex min-h-14 items-center gap-3 py-2 active:opacity-80">
            {pictures[index] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pictures[index]} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold dark:bg-zinc-800" aria-hidden>
                {(person.displayName || person.handle).slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <span className="truncate font-medium">{person.displayName || `@${person.handle}`}</span>
                <VerifiedBadge />
              </p>
              <p className="truncate text-sm text-zinc-500">@{person.handle}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{person.school}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function SchoolResults({ meId, q }: { meId: string; q: string }) {
  const schools = await searchSchools(meId, q);
  if (schools.length === 0) return <Hint>{q.length < 2 ? "Type at least 2 letters." : `No schools found for “${q}”.`}</Hint>;

  return (
    <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
      {schools.map((school) => (
        <li key={school.domain}>
          <Link href={`/?${toSearchParams({ school: school.domain })}`} className="flex min-h-14 items-center justify-between gap-3 py-2 active:opacity-80">
            <div className="min-w-0">
              <p className="truncate font-medium">{school.name}</p>
              <p className="truncate text-sm text-zinc-500">{school.domain}</p>
            </div>
            <span className="shrink-0 text-sm text-zinc-500">
              {school.listings} {school.listings === 1 ? "post" : "posts"} ›
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
