import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { listOwnPosts } from "@/lib/posts/mine";
import { OwnPosts } from "@/app/u/[handle]/own-posts";

export const metadata = { title: "My posts · Studiskarte Marketplace" };

export default function MyPostsPage() {
  return (
    <>
      <PageHeader title="My posts" logo />
      <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-3">
        <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
          <MyPosts />
        </Suspense>
      </main>
    </>
  );
}

async function MyPosts() {
  const me = await requireActiveStudent();
  const posts = await listOwnPosts(me.id);

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        <p className="text-zinc-500">You have not posted yet.</p>
        <Link href="/posts/new" className="flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white">
          Post your first item
        </Link>
      </div>
    );
  }

  const open = posts.filter((p) => p.status === "open");
  const finished = posts.filter((p) => p.status !== "open");

  return (
    <div className="flex flex-col gap-6">
      {open.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Open</h2>
          <OwnPosts posts={open} />
        </section>
      ) : null}
      {finished.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Finished</h2>
          <OwnPosts posts={finished} />
        </section>
      ) : null}
    </div>
  );
}
