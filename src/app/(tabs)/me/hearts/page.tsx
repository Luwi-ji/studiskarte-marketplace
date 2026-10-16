import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { HeartButton } from "@/components/heart-button";
import { PostGrid } from "@/components/post-grid";
import { requireActiveStudent } from "@/lib/access";
import { listHeartedBy } from "@/lib/discovery/feed";
import { listUnavailableHearts } from "@/lib/social/heart";

export const metadata = { title: "Hearted · Studiskarte Marketplace" };

export default function HeartedPage() {
  return (
    <>
      <PageHeader title="Hearted posts" back="/me/settings" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-3">
        <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
          <Hearted />
        </Suspense>
      </main>
    </>
  );
}

async function Hearted() {
  const me = await requireActiveStudent();
  const items = await listHeartedBy(me.id);
  const gone = await listUnavailableHearts(
    me.id,
    items.map((item) => item.id),
  );
  if (items.length === 0 && gone.length === 0) {
    return <p className="px-6 py-16 text-center text-zinc-500">No hearts yet. Tap the heart on a post to save it here. Only you can see them.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {items.length > 0 ? <PostGrid items={items} /> : null}
      {gone.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {gone.map((postId) => (
            <li key={postId} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <span className="text-sm text-zinc-500">A post you hearted is no longer available.</span>
              <HeartButton postId={postId} initial />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
