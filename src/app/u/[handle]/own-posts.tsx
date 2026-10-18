import Link from "next/link";
import { getObjectStore } from "@/lib/images/store";
import { EXPIRED_KEEP_DAYS } from "@/lib/jobs/purge-posts";
import { expiryNotice, formatPrice, quantityLine, STATUS_LABEL } from "@/lib/posts/format";
import type { OwnPost } from "@/lib/posts/mine";
import { PostMenu } from "./post-menu";

const PHOTO_LINK_SECONDS = 5 * 60;
const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** What a student needs to know about one of their own listings, under the photo. */
function Details({ post }: { post: OwnPost }) {
  if (post.status === "open") {
    const notice = expiryNotice(post.expiresAt);
    const counts = [plural(post.viewCount, "view"), plural(post.heartCount, "heart")];
    if (post.pendingOffers > 0) counts.push(`${plural(post.pendingOffers, "offer")} waiting`);
    return (
      <>
        <p className={`text-xs ${notice.warn ? "font-medium text-amber-700 dark:text-amber-400" : "text-zinc-500"}`}>{notice.text}</p>
        <p className="text-xs text-zinc-500">{counts.join(" · ")}</p>
      </>
    );
  }
  if (post.status === "expired") {
    return (
      <p className="text-xs text-amber-700 dark:text-amber-400">
        Expired {dateFormat.format(post.expiresAt)}. Relist within {EXPIRED_KEEP_DAYS} days or it is deleted.
      </p>
    );
  }
  if (post.status === "withdrawn") return <p className="text-xs text-zinc-500">Withdrawn. It will be removed soon.</p>;
  return null;
}

/** The owner's listings as photo cards, each with a "⋯" menu for editing, relisting, withdrawing and deleting. */
export async function OwnPosts({ posts }: { posts: OwnPost[] }) {
  const store = getObjectStore();
  const covers = await Promise.all(posts.map((p) => store.signedUrl(p.coverThumbKey, PHOTO_LINK_SECONDS)));

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {posts.map((p, index) => {
        const taken = quantityLine(p.kind, p.quantity, p.unitsTaken);
        return (
          <li key={p.id} className="relative rounded-xl border border-zinc-200 dark:border-zinc-800">
            <Link href={`/posts/${p.id}`} className="block overflow-hidden rounded-xl active:opacity-80">
              <div className="relative">
                {/* Signed, short-lived link. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={covers[index]} alt="" className={`aspect-square w-full object-cover ${p.status === "open" ? "" : "opacity-60"}`} loading="lazy" />
                {p.status === "open" ? null : (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">{STATUS_LABEL[p.status] ?? p.status}</span>
                )}
              </div>
              <div className="flex flex-col gap-0.5 p-2">
                <p className="text-base font-semibold">{formatPrice(p.priceKind, p.priceAmount)}</p>
                <p className="line-clamp-2 text-sm leading-snug">{p.title}</p>
                <Details post={p} />
                {taken ? <p className="text-xs font-medium text-brand">{taken}</p> : null}
              </div>
            </Link>
            <PostMenu postId={p.id} title={p.title} status={p.status} editLocked={p.editLocked} />
          </li>
        );
      })}
    </ul>
  );
}
