import Link from "next/link";
import type { FeedItem } from "@/lib/discovery/feed";
import { getObjectStore } from "@/lib/images/store";
import { formatPrice, kindLabel } from "@/lib/posts/format";

const PHOTO_LINK_SECONDS = 5 * 60;

/** Two-column cards for a list of posts: the feed, a profile, the hearted list. */
export async function PostGrid({ items }: { items: FeedItem[] }) {
  // Storage is only needed when there are photos to link.
  const store = items.length > 0 ? getObjectStore() : null;
  const photos = store ? await Promise.all(items.map((item) => store.signedUrl(item.thumbKey, PHOTO_LINK_SECONDS))) : [];

  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item, index) => (
        <li key={item.id} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <Link href={`/posts/${item.id}`} className="block active:opacity-80">
            {/* Signed, short-lived links; next/image would route private photos through the optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[index]} alt="" className="aspect-square w-full object-cover" loading="lazy" />
            <div className="flex flex-col gap-0.5 p-2">
              <p className="text-base font-semibold">{formatPrice(item.priceKind, item.priceAmount)}</p>
              <p className="line-clamp-2 text-sm leading-snug">{item.title}</p>
              <p className="truncate text-xs text-zinc-500">
                {kindLabel(item.kind)}
                {item.ownerHandle ? ` · @${item.ownerHandle}` : ""}
              </p>
              <p className="truncate text-xs text-zinc-500">{item.school}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
