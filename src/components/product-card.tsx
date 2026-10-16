import Link from "next/link";
import { formatPrice, STATUS_LABEL } from "@/lib/posts/format";
import type { PostCard } from "@/lib/messaging/read";

/** The post a conversation is about: photo, title, price, and its state if it is not open. */
export function ProductCard({ post, thumbUrl }: { post: PostCard; thumbUrl: string }) {
  return (
    <Link
      href={`/posts/${post.id}`}
      className="flex items-center gap-3 rounded-xl border border-zinc-200 p-2 active:opacity-80 dark:border-zinc-800"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumbUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{post.title}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
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
