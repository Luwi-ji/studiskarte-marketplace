import { Suspense } from "react";
import Link from "next/link";
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
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-8">
      <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400">
        ← Feed
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold">My posts</h1>
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Posts />
      </Suspense>
    </main>
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
      <p className="text-zinc-600 dark:text-zinc-400">
        You have no posts yet.{" "}
        <Link href="/posts/new" className="underline">
          Create one
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-zinc-500">
        {open} of {OPEN_POSTS_MAX} open posts used.
      </p>
      <ul className="flex flex-col gap-3">
        {posts.map((p, index) => (
          <li key={p.id} className="flex gap-3 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
            {/* Signed, short-lived link. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={covers[index]} alt="" className="h-20 w-20 shrink-0 rounded object-cover" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="truncate font-medium">{p.title}</p>
              <p className="text-sm text-zinc-500">
                {p.kind === "wishlist" ? "Wanted" : "Offered"} · {formatPrice(p.priceKind, p.priceAmount)} ·{" "}
                {STATUS_LABEL[p.status] ?? p.status}
              </p>
              {p.status === "open" ? (
                <>
                  <p className="text-xs text-zinc-500">Expires {dateFormat.format(p.expiresAt)}</p>
                  <div className="flex items-center gap-4">
                    <Link href={`/posts/${p.id}/edit`} className="text-sm underline">
                      Edit
                    </Link>
                    <WithdrawButton postId={p.id} title={p.title} />
                  </div>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
