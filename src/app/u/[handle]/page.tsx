import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PostGrid } from "@/components/post-grid";
import { VerifiedBadge } from "@/components/verified-badge";
import { StarRow, Stars } from "@/components/stars";
import { requireActiveStudent } from "@/lib/access";
import { listPostsBy } from "@/lib/discovery/feed";
import { getReputation, listReviews } from "@/lib/deals/stats";
import { getPublicProfile } from "@/lib/identity/profile";
import { getObjectStore } from "@/lib/images/store";
import { getReplyTime, REPLY_LABEL } from "@/lib/messaging/response-time";
import { listOwnPosts } from "@/lib/posts/mine";
import { OPEN_POSTS_MAX, type PostKind } from "@/lib/posts/schema";
import { FollowControls } from "./follow-controls";
import { OwnPosts } from "./own-posts";

export const metadata = { title: "Profile · Studiskarte Marketplace" };

const PICTURE_LINK_SECONDS = 5 * 60;

const TABS: { id: PostKind; label: string }[] = [
  { id: "showcase", label: "Showcase" },
  { id: "wishlist", label: "Wishlist" },
];

export default function ProfilePage({ params, searchParams }: PageProps<"/u/[handle]">) {
  return (
    <>
      <PageHeader title="Profile" back="/" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-4">
        <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
          <Profile params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Profile({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireActiveStudent();
  const profile = await getPublicProfile(me.id, decodeURIComponent((await params).handle));
  if (!profile) notFound();
  const tab: PostKind = (await searchParams).tab === "wishlist" ? "wishlist" : "showcase";
  const base = `/u/${profile.handle}`;

  // Your own profile lists everything you posted, with its controls; anyone else's lists what is open.
  const [own, others, pictureUrl, rep, reply, reviews] = await Promise.all([
    profile.isSelf ? listOwnPosts(profile.id) : null,
    profile.isSelf ? null : listPostsBy(profile.id),
    profile.avatarKey ? getObjectStore().signedUrl(profile.avatarKey, PICTURE_LINK_SECONDS) : null,
    getReputation(profile.id),
    getReplyTime(profile.id),
    listReviews(profile.id),
  ]);
  const shownOwn = own?.filter((p) => p.kind === tab) ?? [];
  const shownOthers = others?.filter((p) => p.kind === tab) ?? [];
  const countOf = (kind: PostKind) =>
    (own ?? others ?? []).filter((p) => p.kind === kind).length;
  const openCount = own?.filter((p) => p.status === "open").length ?? 0;
  const noun = tab === "wishlist" ? "wishlist posts" : "showcase posts";

  return (
    <div className="flex flex-col gap-6">
      <section className="mx-auto flex w-full max-w-md flex-col items-center gap-3 text-center">
        {pictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pictureUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-200 text-4xl font-semibold dark:bg-zinc-800" aria-hidden>
            {(profile.displayName || profile.handle).slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex min-w-0 max-w-full flex-col items-center gap-1">
          <h2 className="max-w-full truncate text-xl font-semibold">{profile.displayName}</h2>
          <p className="max-w-full truncate text-zinc-500">@{profile.handle}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <VerifiedBadge />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">{profile.school}</span>
          </div>
          <p className="flex flex-wrap items-center justify-center gap-x-1 text-sm text-zinc-600 dark:text-zinc-400">
            <Stars average={rep.rating?.average ?? null} count={rep.rating?.count ?? 0} />
            <span>
              · Sold {rep.sold} · Granted {rep.granted}
              {profile.isSelf ? ` · Bought ${rep.bought}` : ""}
            </span>
          </p>
          {reply ? <p className="text-xs text-zinc-500">Typically replies {REPLY_LABEL[reply]}</p> : null}
        </div>
        {profile.isSelf ? (
          <>
            <p className="text-sm">
              <span className="font-semibold">{profile.followerCount}</span> {profile.followerCount === 1 ? "follower" : "followers"}
            </p>
            <div className="w-full">
              <Link href="/me/settings" className="flex h-11 items-center justify-center rounded-lg border border-zinc-300 font-medium dark:border-zinc-700">
                Edit my profile
              </Link>
            </div>
          </>
        ) : (
          <FollowControls handle={profile.handle} initial={profile.isFollowing} followerCount={profile.followerCount} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <nav aria-label="Listings" className="grid grid-cols-2 border-b border-zinc-200 dark:border-zinc-800">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.id === "showcase" ? base : `${base}?tab=${t.id}`}
              replace
              aria-current={t.id === tab ? "page" : undefined}
              className={`flex h-11 items-center justify-center gap-1.5 border-b-2 text-sm ${t.id === tab ? "border-zinc-900 font-semibold dark:border-zinc-50" : "border-transparent text-zinc-500"}`}
            >
              {t.label}
              <span className="text-xs text-zinc-500">{countOf(t.id)}</span>
            </Link>
          ))}
        </nav>
        {profile.isSelf ? (
          <p className="px-1 text-sm text-zinc-500">
            {openCount} of {OPEN_POSTS_MAX} open posts used.
          </p>
        ) : null}
        {(profile.isSelf ? shownOwn : shownOthers).length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <p className="text-zinc-500">{profile.isSelf ? `You have no ${noun} yet.` : `No ${noun} open right now.`}</p>
            {profile.isSelf ? (
              <Link href="/posts/new" className="flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white">
                Create a post
              </Link>
            ) : null}
          </div>
        ) : profile.isSelf ? (
          <OwnPosts posts={shownOwn} />
        ) : (
          <PostGrid items={shownOthers} />
        )}
      </section>

      <section id="reviews" className="mx-auto flex w-full max-w-md scroll-mt-20 flex-col gap-3">
        <h2 className="text-lg font-semibold">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-zinc-500">No reviews yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <StarRow rating={r.rating} />
                {r.text ? <p className="whitespace-pre-wrap text-sm">{r.text}</p> : null}
                <p className="text-xs text-zinc-500">
                  {r.reviewerName} · {r.postTitle} · {r.createdAt.toLocaleDateString("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
