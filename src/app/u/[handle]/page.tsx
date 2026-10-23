import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PostGrid } from "@/components/post-grid";
import { BoughtCount, NewPill, SoldCount } from "@/components/seller-trust";
import { CardGridSkeleton } from "@/components/skeletons";
import { VerifiedBadge } from "@/components/verified-badge";
import { IdCheckedBadge } from "@/components/id-checked-badge";
import { Stars } from "@/components/stars";
import { requireActiveStudent } from "@/lib/access";
import { listPostsBy } from "@/lib/discovery/feed";
import { getReputation } from "@/lib/deals/stats";
import { getPublicProfile } from "@/lib/identity/profile";
import { getObjectStore } from "@/lib/images/store";
import { getReplyTime, REPLY_LABEL } from "@/lib/messaging/response-time";
import { listOwnPosts } from "@/lib/posts/mine";
import { OPEN_POSTS_MAX, type PostKind } from "@/lib/posts/schema";
import { FollowControls } from "./follow-controls";
import { MenuSheet } from "@/app/safety/menu-sheet";
import { REPORT_REASONS } from "@/lib/safety/report";
import { OwnPosts } from "./own-posts";
import { NewPostButton } from "@/components/post-chooser";
import { profileOrigin } from "./origin";

export const metadata = { title: "Profile · Studiskarte Marketplace" };

const PICTURE_LINK_SECONDS = 5 * 60;

const TABS: { id: PostKind; label: string }[] = [
  { id: "showcase", label: "Showcase" },
  { id: "wishlist", label: "Wishlist" },
];

export default function ProfilePage({ params, searchParams }: PageProps<"/u/[handle]">) {
  return (
    <>
      <Suspense fallback={<PageHeader title="Profile" logo />}>
        <ProfileHeader params={params} searchParams={searchParams} />
      </Suspense>
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-4">
        <Suspense fallback={<CardGridSkeleton />}>
          <Profile params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

/** The top bar; on your own profile it carries a Settings gear. */
async function ProfileHeader({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireActiveStudent();
  const own = decodeURIComponent((await params).handle).toLowerCase() === me.handle.toLowerCase();
  // Opened from a listing's seller card, a conversation's name, or someone's Followers or Following list: a back arrow returns there. Anywhere else the logo shows.
  const back = profileOrigin(await searchParams)?.back;
  return (
    <PageHeader
      title="Profile"
      logo={!back}
      back={back}
      action={
        own ? (
          <Link href="/me/settings" aria-label="Settings" className="flex h-11 w-11 items-center justify-center rounded-full">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </Link>
        ) : null
      }
    />
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
  // Kept on the tab links so the back arrow stays.
  const suffix = profileOrigin(await searchParams)?.query ?? "";
  const base = `/u/${profile.handle}`;

  // Your own profile lists everything you posted, with its controls; anyone else's lists what is open.
  const [own, others, pictureUrl, rep, reply] = await Promise.all([
    profile.isSelf ? listOwnPosts(profile.id) : null,
    profile.isSelf ? null : listPostsBy(me.id, profile.id),
    profile.avatarKey ? getObjectStore().signedUrl(profile.avatarKey, PICTURE_LINK_SECONDS) : null,
    getReputation(profile.id),
    getReplyTime(profile.id),
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
          {/* The badges are icons beside the name; tapping one says what it means. */}
          <div className="flex max-w-full items-center justify-center gap-2">
            <h2 className="min-w-0 truncate text-xl font-semibold">{profile.displayName}</h2>
            <VerifiedBadge />
            {profile.idChecked ? <IdCheckedBadge /> : null}
          </div>
          <p className="min-w-0 max-w-full truncate text-base text-zinc-500">@{profile.handle}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{profile.school}</p>
          <div className="flex max-w-full flex-wrap items-center justify-center gap-x-4 text-sm text-zinc-600 dark:text-zinc-400">
            {rep.rating ? (
              <Link href={`${base}/reviews`} className="press inline-flex min-h-11 items-center" aria-label={`Reviews: ${rep.rating.average.toFixed(1)} out of 5 from ${rep.rating.count} reviews`}>
                <Stars average={rep.rating.average} count={rep.rating.count} />
              </Link>
            ) : rep.sold === 0 && rep.granted === 0 ? (
              <span className="inline-flex min-h-11 items-center">
                <NewPill />
              </span>
            ) : (
              <span className="inline-flex min-h-11 items-center">
                <Stars average={null} count={0} />
              </span>
            )}
            {/* A count of zero would be a link to an empty list, so it is left out. */}
            {rep.sold > 0 ? (
              <Link href={`${base}/sold`} className="press inline-flex min-h-11 items-center" aria-label={`${rep.sold} sold, see the list`}>
                <SoldCount count={rep.sold} />
              </Link>
            ) : null}
            {/* Bought is private: only on your own profile. */}
            {profile.isSelf && rep.bought > 0 ? (
              <Link href={`${base}/bought`} className="press inline-flex min-h-11 items-center" aria-label={`${rep.bought} bought, see the list`}>
                <BoughtCount count={rep.bought} />
              </Link>
            ) : null}
          </div>
          {rep.granted > 0 ? (
            <Link href={`${base}/granted`} className="inline-flex min-h-11 items-center text-sm text-zinc-600 underline dark:text-zinc-400">
              Given free {rep.granted}
            </Link>
          ) : null}
          {reply ? <p className="text-xs text-zinc-500">Typically replies {REPLY_LABEL[reply]}</p> : null}
        </div>
        {profile.isSelf ? (
          // Who you follow is private: the count and its list exist only on your own profile.
          <p className="flex items-center justify-center gap-6 text-sm">
            <CountLink href={`${base}/followers`} n={profile.followerCount} one="follower" many="followers" />
            <CountLink href={`${base}/following`} n={profile.followingCount ?? 0} one="following" many="following" />
          </p>
        ) : (
          <FollowControls handle={profile.handle} initial={profile.isFollowing} followerCount={profile.followerCount} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <nav aria-label="Listings" className="grid grid-cols-2 border-b border-zinc-200 dark:border-zinc-800">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.id === "showcase" ? (suffix ? `${base}?${suffix}` : base) : `${base}?tab=${t.id}${suffix ? `&${suffix}` : ""}`}
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
              <NewPostButton canSell={me.role === "student"} className="flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white">
                Create a post
              </NewPostButton>
            ) : null}
          </div>
        ) : profile.isSelf ? (
          <OwnPosts posts={shownOwn} />
        ) : (
          <PostGrid items={shownOthers} />
        )}
      </section>

      {profile.isSelf ? null : (
        <div className="mx-auto w-full max-w-md border-t border-zinc-200 dark:border-zinc-800">
          <MenuSheet
            trigger={{ text: `Report or block @${profile.handle}` }}
            reasons={REPORT_REASONS}
            name={profile.displayName || `@${profile.handle}`}
            handle={profile.handle}
            blockHandle={profile.handle}
          />
        </div>
      )}
    </div>
  );
}

/** A count with its label as a 44 px link, including an empty list. */
function CountLink({ href, n, one, many }: { href: string; n: number; one: string; many: string }) {
  return (
    <Link href={href} className="press inline-flex min-h-11 items-center gap-1">
      <span className="font-semibold">{n}</span> {n === 1 ? one : many}
    </Link>
  );
}
