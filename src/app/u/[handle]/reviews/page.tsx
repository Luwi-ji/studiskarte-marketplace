import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StarRow } from "@/components/stars";
import { requireActiveStudent } from "@/lib/access";
import { listReviews, parsePage } from "@/lib/deals/stats";
import { getPublicProfile } from "@/lib/identity/profile";
import { Pager } from "../pager";

export const metadata = { title: "Reviews · Studiskarte Marketplace" };

const KIND_LABEL = { showcase: "Showcase", wishlist: "Wishlist" } as const;

export default function ReviewsPage({ params, searchParams }: PageProps<"/u/[handle]/reviews">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Reviews" back="/" />
          <main className="mx-auto w-full max-w-md flex-1 px-3 py-4">
            <p className="p-4 text-zinc-500">Loading…</p>
          </main>
        </>
      }
    >
      <Reviews params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Reviews({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireActiveStudent();
  const profile = await getPublicProfile(me.id, decodeURIComponent((await params).handle));
  if (!profile) notFound();
  const base = `/u/${profile.handle}`;
  const page = parsePage((await searchParams).page);
  const { items, hasMore } = await listReviews(me.id, profile.id, page);

  return (
    <>
      <PageHeader title={`Reviews of @${profile.handle}`} back={base} />
      <main className="mx-auto w-full max-w-md flex-1 px-3 py-4">
        <div className="flex flex-col gap-3">
          {items.length === 0 ? (
            <p className="px-1 py-6 text-center text-zinc-500">{page > 1 ? "No more reviews." : "No reviews yet."}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <StarRow rating={r.rating} />
                  <p className="text-xs text-zinc-500">
                    {KIND_LABEL[r.postKind]} · <span className="text-zinc-700 dark:text-zinc-300">{r.postTitle ?? "A listing"}</span>
                  </p>
                  {r.text ? <p className="whitespace-pre-wrap text-sm">{r.text}</p> : null}
                  <p className="text-xs text-zinc-500">
                    {r.reviewerHandle ? (
                      <Link href={`/u/${r.reviewerHandle}`} className="font-medium underline">
                        {r.reviewerLabel}
                      </Link>
                    ) : (
                      r.reviewerLabel
                    )}
                    {" · "}
                    {r.createdAt.toLocaleDateString("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" })}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Pager base={`${base}/reviews`} page={page} hasMore={hasMore} />
        </div>
      </main>
    </>
  );
}
