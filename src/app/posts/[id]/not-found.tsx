import Link from "next/link";
import { PageHeader } from "@/components/page-header";

// Business rule: a link to a closed, hidden or missing post says it is no longer available.
export default function PostNotFound() {
  return (
    <>
      <PageHeader title="Post" back="/" />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 px-6 py-16 text-center">
        <p className="text-lg font-semibold">This post is no longer available</p>
        <p className="text-zinc-600 dark:text-zinc-400">It may have been sold, withdrawn, or expired.</p>
        <Link href="/" className="flex h-12 items-center rounded-full bg-brand px-6 font-medium text-white">
          Back to the feed
        </Link>
      </main>
    </>
  );
}
