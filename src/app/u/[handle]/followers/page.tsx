import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PeopleSkeleton } from "@/components/people-skeleton";
import { FollowHeader, FollowList } from "../follow-list";

export const metadata = { title: "Followers · Studiskarte Marketplace" };

export default function FollowersPage({ params, searchParams }: PageProps<"/u/[handle]/followers">) {
  return (
    <>
      <Suspense fallback={<PageHeader title="Followers" />}>
        <FollowHeader kind="followers" params={params} />
      </Suspense>
      <main className="mx-auto w-full max-w-md flex-1 py-2">
        <Suspense fallback={<PeopleSkeleton />}>
          <FollowList kind="followers" params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}
