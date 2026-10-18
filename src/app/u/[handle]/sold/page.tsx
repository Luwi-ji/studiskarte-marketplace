import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { HandoverList } from "../handover-list";

export const metadata = { title: "Sold · Studiskarte Marketplace" };

export default function SoldPage({ params, searchParams }: PageProps<"/u/[handle]/sold">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Sold" back="/" />
          <main className="mx-auto w-full max-w-md flex-1 px-3 py-4">
            <p className="p-4 text-zinc-500">Loading…</p>
          </main>
        </>
      }
    >
      <HandoverList kind="sold" params={params} searchParams={searchParams} />
    </Suspense>
  );
}
