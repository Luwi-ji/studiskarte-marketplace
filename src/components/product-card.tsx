import Link from "next/link";
import { formatPrice, STATUS_LABEL } from "@/lib/posts/format";
import type { PostCard } from "@/lib/messaging/read";

/**
 * A listing: photo, title, price, its own state if it is not open, and where a
 * transaction on it stands (`state`). Tapping it opens the listing. `compact`
 * is the slimmer form.
 */
export function ProductCard({ post, thumbUrl, state = null, compact = false }: { post: PostCard; thumbUrl: string; state?: string | null; compact?: boolean }) {
  return (
    <Link
      href={`/posts/${post.id}`}
      className={`flex items-center gap-3 active:opacity-80 ${compact ? "min-h-11" : "rounded-xl border border-zinc-200 p-2 dark:border-zinc-800"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumbUrl} alt="" className={`shrink-0 rounded-lg object-cover ${compact ? "h-11 w-11" : "h-14 w-14"}`} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 break-words font-medium leading-snug">{post.title}</p>
        <p className={`text-zinc-600 dark:text-zinc-400 ${compact ? "truncate text-xs" : "text-sm"}`}>
          {formatPrice(post.priceKind, post.priceAmount)}
          {post.status !== "open" ? ` · ${STATUS_LABEL[post.status] ?? post.status}` : ""}
          {state ? ` · ${state}` : ""}
        </p>
      </div>
      <span aria-hidden className="text-xl text-zinc-400">
        ›
      </span>
    </Link>
  );
}
