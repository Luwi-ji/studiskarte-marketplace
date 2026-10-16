import Link from "next/link";
import { formatPrice, STATUS_LABEL } from "@/lib/posts/format";
import type { PostCard } from "@/lib/messaging/read";

/**
 * The post a conversation is about: photo, title, price, and its state if it is
 * not open. `compact` is the slimmer form that stays in view above a long thread.
 */
export function ProductCard({ post, thumbUrl, compact = false }: { post: PostCard; thumbUrl: string; compact?: boolean }) {
  return (
    <Link
      href={`/posts/${post.id}`}
      className={`flex items-center gap-3 active:opacity-80 ${compact ? "min-h-11" : "rounded-xl border border-zinc-200 p-2 dark:border-zinc-800"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumbUrl} alt="" className={`shrink-0 rounded-lg object-cover ${compact ? "h-11 w-11" : "h-14 w-14"}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{post.title}</p>
        <p className={`text-zinc-600 dark:text-zinc-400 ${compact ? "truncate text-xs" : "text-sm"}`}>
          {formatPrice(post.priceKind, post.priceAmount)}
          {post.status !== "open" ? ` · ${STATUS_LABEL[post.status] ?? post.status}` : ""}
        </p>
      </div>
      <span aria-hidden className="text-xl text-zinc-400">
        ›
      </span>
    </Link>
  );
}
