import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PostGrid } from "@/components/post-grid";
import { VerifiedBadge } from "@/components/verified-badge";
import { requireActiveStudent } from "@/lib/access";
import { listPostsBy } from "@/lib/discovery/feed";
import { getPublicProfile } from "@/lib/identity/profile";
import { getObjectStore } from "@/lib/images/store";
import { FollowControls } from "./follow-controls";

export const metadata = { title: "Profile · Studiskarte Marketplace" };

const PICTURE_LINK_SECONDS = 5 * 60;

export default function ProfilePage({ params }: PageProps<"/u/[handle]">) {
  return (
    <>
      <PageHeader title="Profile" back="/" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-4">
        <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
          <Profile params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Profile({ params }: { params: Promise<{ handle: string }> }) {
  const me = await requireActiveStudent();
  const profile = await getPublicProfile(me.id, decodeURIComponent((await params).handle));
  if (!profile) notFound();
  const [items, pictureUrl] = await Promise.all([
    listPostsBy(profile.id),
    profile.avatarKey ? getObjectStore().signedUrl(profile.avatarKey, PICTURE_LINK_SECONDS) : null,
  ]);

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
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Active listings</h3>
        {items.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">No active listings right now.</p>
        ) : (
          <PostGrid items={items} />
        )}
      </section>
    </div>
  );
}
