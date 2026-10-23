import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { SHOWCASE_STUDENTS_ONLY } from "@/lib/posts/audience";
import { listCategories } from "@/lib/posts/categories";
import type { PostKind } from "@/lib/posts/schema";
import { PostFormSkeleton } from "../form-skeleton";
import { PostForm } from "../post-form";
import { prefillFrom } from "./prefill";

const COPY: Record<PostKind, { title: string; intro: string }> = {
  showcase: { title: "New Showcase post", intro: "Offer an item or a service to students. Add photos, a price and when you can meet." },
  wishlist: { title: "New Wishlist post", intro: "Tell students what you are looking for and what you can spend." },
};

/** One page per kind of post: its own title and words, then the form. `/posts/new` chooses between them. */
export function NewPostScreen({ kind, searchParams }: { kind: PostKind; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return (
    <>
      <PageHeader title={COPY[kind].title} back="/posts/new" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4">
        <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">{COPY[kind].intro}</p>
        <Suspense fallback={<PostFormSkeleton />}>
          <Guarded kind={kind} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Guarded({ kind, searchParams }: { kind: PostKind; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireActiveStudent();
  // Only students can sell or give; everyone else can post what they are looking for.
  if (kind === "showcase" && me.role !== "student") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <p className="text-zinc-700 dark:text-zinc-300">{SHOWCASE_STUDENTS_ONLY}</p>
        <Link href="/posts/new/wishlist" className="flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white">
          Post to Wishlist
        </Link>
      </div>
    );
  }
  const prefill = prefillFrom(await searchParams);
  // A new key starts a fresh form even when Next.js has kept an earlier one alive.
  return <PostForm key={prefill ? JSON.stringify(prefill) : "blank"} mode="create" kind={kind} categories={await listCategories()} prefill={prefill} />;
}
