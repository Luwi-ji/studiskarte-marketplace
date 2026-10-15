import { Suspense } from "react";
import Link from "next/link";
import { requireActiveStudent } from "@/lib/access";
import { listFeed } from "@/lib/discovery/feed";
import { getObjectStore } from "@/lib/images/store";
import { signOut } from "./(public)/sign-in/actions";

const PHOTO_LINK_SECONDS = 5 * 60;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Feed />
      </Suspense>
    </main>
  );
}

async function Feed() {
  await requireActiveStudent();
  const items = await listFeed();
  // Storage is only needed when there are photos to link.
  const store = items.length > 0 ? getObjectStore() : null;
  const photos = store
    ? await Promise.all(items.map((item) => store.signedUrl(item.thumbKey, PHOTO_LINK_SECONDS)))
    : [];

  return (
    <>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Studiskarte</h1>
        <div className="flex items-center gap-4">
          <Link href="/posts/new" className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900">
            New post
          </Link>
          <Link href="/me/settings" className="text-sm text-zinc-600 dark:text-zinc-400">
            Settings
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-sm text-zinc-600 dark:text-zinc-400">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {items.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">Nothing posted yet. Be the first.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {items.map((item, index) => (
            <li key={item.id} className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              {/* Signed, short-lived links; next/image would route private photos through the optimizer. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photos[index]} alt="" className="aspect-square w-full object-cover" loading="lazy" />
              <div className="p-2">
                <p className="truncate font-medium">{item.title}</p>
                <p className="truncate text-xs text-zinc-500">
                  {item.kind === "wishlist" ? "Wanted" : "Offered"}
                  {item.ownerHandle ? ` · @${item.ownerHandle}` : ""}
                </p>
                <p className="truncate text-xs text-zinc-500">{item.school}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
