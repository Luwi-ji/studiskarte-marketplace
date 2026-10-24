import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { VerifiedBadge } from "@/components/verified-badge";
import { GuestBadge } from "@/components/guest-badge";
import { requireActiveStudent } from "@/lib/access";
import { getPublicProfile } from "@/lib/identity/profile";
import { getObjectStore } from "@/lib/images/store";
import { FOLLOW_LIST_STEP, listFollowers, listFollowing, parseShown } from "@/lib/social/follow";
import { ShowMore } from "./show-more";

export type FollowKind = "followers" | "following";

const TITLE: Record<FollowKind, string> = { followers: "Followers", following: "Following" };
const AVATAR_LINK_SECONDS = 5 * 60;

/** The top bar of a Followers or Following page: Back returns to the profile the list belongs to. Needs only the address, so it is there at once. */
export async function FollowHeader({ kind, params }: { kind: FollowKind; params: Promise<{ handle: string }> }) {
  const handle = decodeURIComponent((await params).handle).toLowerCase();
  return <PageHeader title={TITLE[kind]} back={`/u/${encodeURIComponent(handle)}`} />;
}

/**
 * The people who follow a student (open to every signed-in viewer of that profile) or the people a student follows
 * (the student's own list only: anyone else gets a plain 404, like a profile that does not exist). Each row opens that
 * person's profile with `?followers=<handle>` or `?following=<handle>`, so its back arrow returns to this list.
 */
export async function FollowList({
  kind,
  params,
  searchParams,
}: {
  kind: FollowKind;
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireActiveStudent();
  const profile = await getPublicProfile(me.id, decodeURIComponent((await params).handle));
  if (!profile || (kind === "following" && !profile.isSelf)) notFound();

  const shown = parseShown((await searchParams).shown);
  const { items, hasMore } = kind === "followers" ? await listFollowers(me.id, profile.id, shown) : await listFollowing(me.id, profile.id, shown);
  const store = getObjectStore();
  const pictures = await Promise.all(items.map((p) => (p.avatarThumbKey ? store.signedUrl(p.avatarThumbKey, AVATAR_LINK_SECONDS) : null)));

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        <p className="text-zinc-500">
          {kind === "following" ? "You are not following anyone yet." : profile.isSelf ? "No one follows you yet." : `No one follows @${profile.handle} yet.`}
        </p>
        {kind === "following" ? (
          <Link href="/search?tab=people" className="flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white">
            Search for people
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {items.map((person, index) => (
          <li key={person.handle}>
            <Link href={`/u/${person.handle}?${kind}=${profile.handle}`} className="press-row flex min-h-16 items-center gap-3 px-3 py-2">
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
                  {person.isGuest ? <GuestBadge interactive={false} /> : <VerifiedBadge interactive={false} />}
                </p>
                <p className="truncate text-sm text-zinc-500">
                  @{person.handle} · {person.school}
                </p>
              </div>
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-none stroke-zinc-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
      {hasMore ? <ShowMore href={`/u/${profile.handle}/${kind}?shown=${shown + FOLLOW_LIST_STEP}`} /> : null}
    </div>
  );
}
