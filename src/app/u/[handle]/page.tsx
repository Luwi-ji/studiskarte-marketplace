import { cache, Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PostGrid } from "@/components/post-grid";
import { BackToTop } from "@/components/back-to-top";
import { BoughtCount, FollowersCount, FollowingCount, NewPill, PinIcon, SoldCount, STAT_LINK, STAT_ROW } from "@/components/seller-trust";
import { CardGridSkeleton } from "@/components/skeletons";
import { VerifiedBadge } from "@/components/verified-badge";
import { IdCheckedBadge } from "@/components/id-checked-badge";
import { FoundingUserBadge } from "@/components/founding-user-badge";
import { JoinedChip } from "@/components/joined-chip";
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
import { ProfileTabs } from "./profile-tabs";
import { PendingNav, PendingResults } from "@/components/pending-nav";
import { GuestBadge } from "@/components/guest-badge";
import { NewPostButton } from "@/components/post-chooser";
import { profileOrigin } from "./origin";

export const metadata = { title: "Profile · Studiskarte Marketplace" };

/** The header and the body both need the profile; one read per request. */
const profileFor = cache((viewerId: string, handle: string) => getPublicProfile(viewerId, handle));

const PICTURE_LINK_SECONDS = 5 * 60;
const PROFILE_LIST_LIMIT = 60;

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
        <PendingNav>
          <Suspense fallback={<CardGridSkeleton />}>
            <Profile params={params} searchParams={searchParams} />
          </Suspense>
        </PendingNav>
      </main>
    </>
  );
}

/** The top bar: a Settings gear on your own profile, and on anyone else's the three-dot menu to report or block them. */
async function ProfileHeader({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireActiveStudent();
  const handle = decodeURIComponent((await params).handle);
  const own = handle.toLowerCase() === me.handle.toLowerCase();
  // Nobody to report when the profile is not there (deleted, suspended or blocked): the page says so, the bar has no menu.
  const other = own ? null : await profileFor(me.id, handle);
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
        ) : other ? (
          <MenuSheet trigger="plain" reasons={REPORT_REASONS} name={other.displayName || `@${other.handle}`} handle={other.handle} blockHandle={other.handle} />
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
  const profile = await profileFor(me.id, decodeURIComponent((await params).handle));
  if (!profile) notFound();
  const tab: PostKind = (await searchParams).tab === "wishlist" ? "wishlist" : "showcase";
  // Kept on the tab links so the back arrow stays.
  const suffix = profileOrigin(await searchParams)?.query ?? "";
  const base = `/u/${profile.handle}`;

  // Your own profile lists everything you posted, with its controls; anyone else's lists what is open.
  const [own, others, pictureUrl, rep, reply] = await Promise.all([
    profile.isSelf ? listOwnPosts(profile.id) : null,
    profile.isSelf ? null : listPostsBy(me.id, profile.id, PROFILE_LIST_LIMIT + 1),
    profile.avatarKey ? getObjectStore().signedUrl(profile.avatarKey, PICTURE_LINK_SECONDS) : null,
    getReputation(profile.id),
    getReplyTime(profile.id),
  ]);
  const shownOwn = own?.filter((p) => p.kind === tab) ?? [];
  // The extra row detects a capped public list without calling it complete.
  const publicPosts = others && others.length > PROFILE_LIST_LIMIT ? others.slice(0, PROFILE_LIST_LIMIT) : others ?? [];
  const shownOthers = publicPosts.filter((p) => p.kind === tab);
  const countOf = (kind: PostKind) =>
    (own ?? publicPosts).filter((p) => p.kind === kind).length;
  const openCount = own?.filter((p) => p.status === "open").length ?? 0;
  const noun = tab === "wishlist" ? "wishlist posts" : "showcase posts";

  // The counts that sit beside followers in the one stats row. A count of zero would be a link to an empty list, so it is left out.
  const soldLink =
    rep.sold > 0 ? (
      <Link href={`${base}/sold`} className={STAT_LINK} aria-label={`${rep.sold} sold, see the list`}>
        <SoldCount count={rep.sold} />
      </Link>
    ) : null;
  // Bought is private: only on your own profile.
  const boughtLink =
    profile.isSelf && rep.bought > 0 ? (
      <Link href={`${base}/bought`} className={STAT_LINK} aria-label={`${rep.bought} bought, see the list`}>
        <BoughtCount count={rep.bought} />
      </Link>
    ) : null;

  const joinedChip = <JoinedChip joinedAt={profile.joinedAt.toISOString()} />;

  return (
    <div className="flex flex-col gap-2">
      <section className="mx-auto flex w-full max-w-md flex-col gap-2 px-1">
        <div className="flex items-center gap-4">
          {pictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pictureUrl} alt="" className="h-20 w-20 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-3xl font-semibold dark:bg-zinc-800" aria-hidden>
              {(profile.displayName || profile.handle).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* The badges sit after the name on the same line; the name gives way first. Tapping a badge opens its name in place. */}
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="min-w-0 truncate text-xl font-semibold leading-tight">{profile.displayName}</h2>
              <span className="flex shrink-0 items-center gap-2">
                {profile.isGuest ? <GuestBadge /> : <VerifiedBadge />}
                {profile.idChecked ? <IdCheckedBadge /> : null}
                {profile.isFoundingUser ? <FoundingUserBadge /> : null}
              </span>
            </div>
            {/* The star rating sits beside the handle. Its link keeps a 44 px target without making the line taller. */}
            <div className="flex min-w-0 items-center gap-x-2 text-sm text-zinc-500">
              <p className="min-w-0 truncate">@{profile.handle}</p>
              <span className="flex shrink-0 items-center text-zinc-600 dark:text-zinc-400">
                {rep.rating ? (
                  <Link href={`${base}/reviews`} className="press -my-3 inline-flex min-h-11 items-center" aria-label={`Reviews: ${rep.rating.average.toFixed(1)} out of 5 from ${rep.rating.count} reviews`}>
                    <Stars average={rep.rating.average} count={rep.rating.count} />
                  </Link>
                ) : rep.sold === 0 && rep.granted === 0 ? (
                  <NewPill />
                ) : (
                  <Stars average={null} count={0} />
                )}
              </span>
            </div>
            {/* School, then where they are based. Only the owner sees a prompt when the location is empty, and it opens the editor. */}
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 text-sm text-zinc-600 dark:text-zinc-400">
              {profile.isGuest ? null : (
                <p className="flex min-w-0 items-center gap-1.5" title={profile.school}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" />
                  </svg>
                  <span className="truncate">{profile.schoolShort}</span>
                </p>
              )}
              {profile.location ? (
                profile.isSelf ? (
                  <Link href="/me/settings/profile/location" className="press -my-2 inline-flex min-h-11 min-w-0 items-center gap-1.5" aria-label={`Location: ${profile.location}. Edit`}>
                    <PinIcon />
                    <span className="truncate">{profile.location}</span>
                  </Link>
                ) : (
                  <p className="flex min-w-0 items-center gap-1.5" title={profile.location}>
                    <PinIcon />
                    <span className="truncate">{profile.location}</span>
                  </p>
                )
              ) : profile.isSelf ? (
                <Link href="/me/settings/profile/location" className="press -my-2 inline-flex min-h-11 items-center gap-1.5 text-zinc-500">
                  <PinIcon />
                  <span>Add location</span>
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {profile.bio ? <p className="break-words text-sm leading-snug text-zinc-600 dark:text-zinc-400">{profile.bio}</p> : null}

        {profile.isSelf ? (
          // Who you follow is private: the count and its list exist only on your own profile.
          <div className={STAT_ROW}>
            <Link href={`${base}/followers`} className={STAT_LINK} aria-label={`${profile.followerCount} ${profile.followerCount === 1 ? "follower" : "followers"}, see the list`}>
              <FollowersCount count={profile.followerCount} />
            </Link>
            <Link href={`${base}/following`} className={STAT_LINK} aria-label={`${profile.followingCount ?? 0} following, see the list`}>
              <FollowingCount count={profile.followingCount ?? 0} />
            </Link>
            {soldLink}
            {boughtLink}
            {joinedChip}
          </div>
        ) : (
          <FollowControls handle={profile.handle} initial={profile.isFollowing} followerCount={profile.followerCount}>
            {soldLink}
            {joinedChip}
          </FollowControls>
        )}

        {rep.granted > 0 || reply ? (
          <div className="flex flex-wrap items-center gap-x-4 text-sm text-zinc-600 dark:text-zinc-400">
            {rep.granted > 0 ? (
              <Link href={`${base}/granted`} className="inline-flex min-h-11 items-center underline">
                Given free {rep.granted}
              </Link>
            ) : null}
            {reply ? <p className="text-xs text-zinc-500">Typically replies {REPLY_LABEL[reply]}</p> : null}
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <ProfileTabs
          current={tab}
          tabs={TABS.map((t) => ({
            id: t.id,
            label: t.label,
            count: countOf(t.id),
            href: t.id === "showcase" ? (suffix ? `${base}?${suffix}` : base) : `${base}?tab=${t.id}${suffix ? `&${suffix}` : ""}`,
          }))}
        />
        <PendingResults skeleton={<CardGridSkeleton />} className="flex flex-col gap-3">
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
          {(profile.isSelf ? shownOwn.length > 0 : shownOthers.length > 0 && (others?.length ?? 0) <= PROFILE_LIST_LIMIT) ? (
            <div className="flex flex-col items-center gap-1 py-3 text-zinc-500">
              <p className="text-sm">You&apos;ve seen everything</p>
              <BackToTop />
            </div>
          ) : null}
        </PendingResults>
      </section>

    </div>
  );
}
