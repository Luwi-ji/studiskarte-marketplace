import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PendingNav } from "@/components/pending-nav";
import { requireActiveStudent } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { EXPIRED_KEEP_DAYS } from "@/lib/jobs/purge-posts";
import { expiryNotice, quantityLine } from "@/lib/posts/format";
import { listOwnPosts, type OwnPost } from "@/lib/posts/mine";
import { countOwnPosts, inOwnView, parseOwnView } from "@/lib/posts/own-view";
import { OPEN_POSTS_MAX } from "@/lib/posts/schema";
import { LISTING_DAYS } from "@/lib/posts/update";
import { MyPostsView, type OwnRow } from "./my-posts-view";
import { OwnPostsSkeleton, StatusRowSkeleton, TypeStripSkeleton } from "./skeleton";

export const metadata = { title: "My posts · Studiskarte Marketplace" };

const PHOTO_LINK_SECONDS = 5 * 60;
const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

function plural(n: number, one: string) {
  return `${n} ${n === 1 ? one : `${one}s`}`;
}

/** What a student needs to know about one of their own posts, under its title. */
function linesFor(p: OwnPost): OwnRow["lines"] {
  const taken = quantityLine(p.kind, p.quantity, p.unitsTaken);
  const counts = [plural(p.viewCount, "view"), plural(p.heartCount, "heart")];
  if (p.pendingOffers > 0) counts.push(`${plural(p.pendingOffers, "offer")} waiting`);
  if (p.status === "open") {
    const notice = expiryNotice(p.expiresAt);
    return [{ text: notice.text, warn: notice.warn }, { text: counts.join(" · ") }, ...(taken ? [{ text: taken }] : [])];
  }
  if (p.status === "reserved") return [{ text: counts.join(" · ") }, ...(taken ? [{ text: taken }] : [])];
  if (p.status === "expired") return [{ text: `Expired ${dateFormat.format(p.expiresAt)}. Relist within ${EXPIRED_KEEP_DAYS} days or it is deleted.`, warn: true }];
  if (p.status === "withdrawn") return [{ text: "Withdrawn. It will be removed soon." }];
  return taken ? [{ text: taken }] : [];
}

export default function MyPostsPage({ searchParams }: PageProps<"/me/posts">) {
  return (
    <PendingNav>
      <Suspense
        fallback={
          <>
            <PageHeader title="My posts" logo />
            <TypeStripSkeleton />
            <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-3">
              <div className="flex flex-col gap-1">
                <StatusRowSkeleton />
                <div className="pt-1">
                  <OwnPostsSkeleton />
                </div>
              </div>
            </main>
          </>
        }
      >
        <MyPosts searchParams={searchParams} />
      </Suspense>
    </PendingNav>
  );
}

async function MyPosts({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireActiveStudent();
  const view = parseOwnView(await searchParams);
  const posts = await listOwnPosts(me.id);
  const counts = countOwnPosts(posts);
  const store = getObjectStore();
  const rows: OwnRow[] = await Promise.all(
    inOwnView(posts, view).map(async (p) => ({
      id: p.id,
      kind: p.kind,
      status: p.status,
      title: p.title,
      priceKind: p.priceKind,
      priceAmount: p.priceAmount,
      cover: await store.signedUrl(p.coverThumbKey, PHOTO_LINK_SECONDS),
      lines: linesFor(p),
      editLocked: p.editLocked,
    })),
  );

  return (
    <MyPostsView
      key={`${view.type}:${view.status}`}
      view={view}
      counts={counts}
      rows={rows}
      // Only open posts count against the limit (reserved ones do not), the same count the server checks when you post or relist.
      usage={{ open: posts.filter((p) => p.status === "open").length, max: OPEN_POSTS_MAX }}
      listingDays={LISTING_DAYS}
      expiredKeepDays={EXPIRED_KEEP_DAYS}
      canSell={me.role === "student"}
    />
  );
}
