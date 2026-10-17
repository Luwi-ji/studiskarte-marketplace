import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { listCategories } from "@/lib/posts/categories";
import { PostForm } from "../post-form";

export const metadata = { title: "Create a post · Studiskarte Marketplace" };

export default function NewPostPage() {
  return (
    <>
      <PageHeader title="Create a post" back="/" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4">
        <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
          <Guarded />
        </Suspense>
      </main>
    </>
  );
}

async function Guarded() {
  await requireActiveStudent();
  return <PostForm mode="create" categories={await listCategories()} />;
}
