import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { HandoverList } from "../handover-list";

export const metadata = { title: "Bought · Studiskarte Marketplace" };

export default function BoughtPage({ params, searchParams }: PageProps<"/u/[handle]/bought">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Bought" back="/" />
          <main className="mx-auto w-full max-w-md flex-1 px-3 py-4">
            <p className="p-4 text-zinc-500">Loading…</p>
          </main>
        </>
      }
    >
      <HandoverList kind="bought" params={params} searchParams={searchParams} />
    </Suspense>
  );
}
