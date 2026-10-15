import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { formatPrice, STATUS_LABEL } from "@/lib/posts/format";
import { listOwnPosts } from "@/lib/posts/mine";
import { OPEN_POSTS_MAX } from "@/lib/posts/schema";
import { WithdrawButton } from "./withdraw-button";

export const metadata = { title: "My posts · Studiskarte Marketplace" };

const PHOTO_LINK_SECONDS = 5 * 60;
const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

export default function MyPostsPage() {
  return (
    <>
      <PageHeader title="My posts" />
      <main className="mx-auto w-full max-w-md flex-1 px-3 py-3">
        <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
          <Posts />
        </Suspense>
      </main>
    </>
  );
}

async function Posts() {
  const me = await requireActiveStudent();
  const posts = await listOwnPosts(me.id);
  const open = posts.filter((p) => p.status === "open").length;
  const store = posts.length > 0 ? getObjectStore() : null;
  const covers = store ? await Promise.all(posts.map((p) => store.signedUrl(p.coverThumbKey, PHOTO_LINK_SECONDS))) : [];

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">You have no posts yet.</p>
        <Link href="/posts/new" className="flex h-12 items-center rounded-full bg-zinc-900 px-6 font-medium text-white dark:bg-zinc-50 dark:text-zinc-900">
          Create a post
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="px-1 pb-3 text-sm text-zinc-500">
        {open} of {OPEN_POSTS_MAX} open posts used.
      </p>
      <ul className="flex flex-col gap-2">
        {posts.map((p, index) => (
          <li key={p.id} className="rounded-xl border border-zinc-200 p-2 dark:border-zinc-800">
            <Link href={`/posts/${p.id}`} className="flex gap-3 active:opacity-80">
              {/* Signed, short-lived link. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={covers[index]} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate font-medium">{p.title}</p>
                <p className="text-sm font-semibold">{formatPrice(p.priceKind, p.priceAmount)}</p>
                <p className="text-sm text-zinc-500">
                  {p.kind === "wishlist" ? "Wanted" : "Offered"} · {STATUS_LABEL[p.status] ?? p.status}
                </p>
                {p.status === "open" ? <p className="text-xs text-zinc-500">Expires {dateFormat.format(p.expiresAt)}</p> : null}
              </div>
            </Link>
            {p.status === "open" ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link href={`/posts/${p.id}/edit`} className="flex h-11 items-center justify-center rounded-lg border border-zinc-300 text-sm font-medium dark:border-zinc-700">
                  Edit
                </Link>
                <WithdrawButton postId={p.id} title={p.title} />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
