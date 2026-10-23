import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PostChoices } from "@/components/post-chooser";
import { requireActiveStudent } from "@/lib/access";
import { carriedQuery, kindFrom } from "./prefill";

export const metadata = { title: "Create a post · Studiskarte Marketplace" };

/** Opened directly, `/posts/new` is the chooser. The old `?kind=` address goes on to that kind's own page. */
export default function NewPostPage({ searchParams }: PageProps<"/posts/new">) {
  return (
    <>
      <PageHeader title="Create a post" back="/" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4">
        <Suspense fallback={<div aria-hidden className="h-44 rounded-lg bg-zinc-200 motion-safe:animate-pulse dark:bg-zinc-800" />}>
          <Choose searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Choose({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireActiveStudent();
  const raw = await searchParams;
  const kind = kindFrom(raw);
  if (kind === "wishlist" || (kind === "showcase" && me.role === "student")) redirect(`/posts/new/${kind}${carriedQuery(raw)}`);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-zinc-600 dark:text-zinc-400">What do you want to post?</p>
      <PostChoices canSell={me.role === "student"} />
    </div>
  );
}
