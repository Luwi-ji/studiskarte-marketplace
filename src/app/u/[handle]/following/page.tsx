import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PeopleSkeleton } from "@/components/people-skeleton";
import { FollowHeader, FollowList } from "../follow-list";

export const metadata = { title: "Following · Studiskarte Marketplace" };

/** Only the student's own list: anyone else gets a 404 from FollowList. */
export default function FollowingPage({ params, searchParams }: PageProps<"/u/[handle]/following">) {
  return (
    <>
      <Suspense fallback={<PageHeader title="Following" />}>
        <FollowHeader kind="following" params={params} />
      </Suspense>
      <main className="mx-auto w-full max-w-md flex-1 py-2">
        <Suspense fallback={<PeopleSkeleton />}>
          <FollowList kind="following" params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}
