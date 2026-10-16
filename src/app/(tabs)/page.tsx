import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PostGrid } from "@/components/post-grid";
import { requireActiveStudent } from "@/lib/access";
import { listFeed } from "@/lib/discovery/feed";

export default function Home() {
  return (
    <>
      <PageHeader title="Studiskarte" logo />
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
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">Nothing posted yet. Be the first.</p>
        <Link
          href="/posts/new"
          className="flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white"
        >
          Sell or ask for something
        </Link>
      </div>
    );
  }

  return <PostGrid items={items} />;
}
