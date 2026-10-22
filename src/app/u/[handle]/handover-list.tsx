import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { listHandovers, parsePage, type HandoverKind } from "@/lib/deals/stats";
import { getPublicProfile } from "@/lib/identity/profile";
import { Pager } from "./pager";

const KIND_LABEL = { showcase: "Showcase", wishlist: "Wishlist" } as const;

const COPY: Record<HandoverKind, { title: string; empty: string }> = {
  sold: { title: "Sold", empty: "Nothing sold yet." },
  granted: { title: "Given free", empty: "Nothing given away yet." },
  bought: { title: "Bought", empty: "Nothing bought yet." },
};

/**
 * The completed handovers behind a Sold, Granted or Bought count. Sold and
 * Granted are open to every signed-in viewer of the profile; Bought answers
 * not-found for anyone but the student themselves.
 */
export async function HandoverList({
  kind,
  params,
  searchParams,
}: {
  kind: HandoverKind;
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireActiveStudent();
  const profile = await getPublicProfile(me.id, decodeURIComponent((await params).handle));
  if (!profile || (kind === "bought" && !profile.isSelf)) notFound();
  const base = `/u/${profile.handle}`;
  const page = parsePage((await searchParams).page);
  const { items, hasMore } = await listHandovers({ viewerId: me.id, studentId: profile.id, kind, page });
  const copy = COPY[kind];

  return (
    <>
      <PageHeader title={`${copy.title} by @${profile.handle}`} back={base} />
      <main className="mx-auto w-full max-w-md flex-1 px-3 py-4">
        <div className="flex flex-col gap-3">
          {items.length === 0 ? (
            <p className="px-1 py-6 text-center text-zinc-500">{page > 1 ? "No more." : copy.empty}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.dealId} className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="text-xs text-zinc-500">{KIND_LABEL[item.postKind]}</p>
                  <p className="font-medium">{item.postTitle ?? "A listing"}</p>
                  <p className="text-xs text-zinc-500">
                    {item.quantity} {item.quantity === 1 ? "unit" : "units"} ·{" "}
                    {item.completedAt.toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" })}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Pager base={`${base}/${kind}`} page={page} hasMore={hasMore} />
        </div>
      </main>
    </>
  );
}
