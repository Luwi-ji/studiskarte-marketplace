import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { listFeed } from "@/lib/discovery/feed";
import { getObjectStore } from "@/lib/images/store";
import { formatPrice } from "@/lib/posts/format";

const PHOTO_LINK_SECONDS = 5 * 60;

export default function Home() {
  return (
    <>
      <PageHeader title="Studiskarte" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-3">
        <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
          <Feed />
        </Suspense>
      </main>
    </>
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

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">Nothing posted yet. Be the first.</p>
        <Link
          href="/posts/new"
          className="flex h-12 items-center rounded-full bg-zinc-900 px-6 font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
        >
          Sell or ask for something
        </Link>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item, index) => (
        <li key={item.id} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          {/* Signed, short-lived links; next/image would route private photos through the optimizer. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[index]} alt="" className="aspect-square w-full object-cover" loading="lazy" />
          <div className="flex flex-col gap-0.5 p-2">
            <p className="text-base font-semibold">{formatPrice(item.priceKind, item.priceAmount)}</p>
            <p className="line-clamp-2 text-sm leading-snug">{item.title}</p>
            <p className="truncate text-xs text-zinc-500">
              {item.kind === "wishlist" ? "Wanted" : "Offered"}
              {item.ownerHandle ? ` · @${item.ownerHandle}` : ""}
            </p>
            <p className="truncate text-xs text-zinc-500">{item.school}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
