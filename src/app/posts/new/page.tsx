import { Suspense } from "react";
import Link from "next/link";
import { requireActiveStudent } from "@/lib/access";
import { listCategories } from "@/lib/posts/categories";
import { PostForm } from "../post-form";

export const metadata = { title: "New post · Studiskarte Marketplace" };

export default function NewPostPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-8">
      <Link href="/" className="text-sm text-zinc-600 dark:text-zinc-400">
        ← Back
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-semibold">New post</h1>
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Guarded />
      </Suspense>
    </main>
  );
}

async function Guarded() {
  await requireActiveStudent();
  return <PostForm mode="create" categories={await listCategories()} />;
}
