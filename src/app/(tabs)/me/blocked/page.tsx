import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { UnblockButton } from "@/app/safety/block-button";
import { requireActiveStudent } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { listBlocked } from "@/lib/safety/block";

export const metadata = { title: "Blocked students · Studiskarte Marketplace" };

const PICTURE_LINK_SECONDS = 5 * 60;

export default function BlockedPage() {
  return (
    <>
      <PageHeader title="Blocked students" back="/me/settings" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
          <Blocked />
        </Suspense>
      </main>
    </>
  );
}

async function Blocked() {
  const me = await requireActiveStudent();
  const blocked = await listBlocked(me.id);
  if (blocked.length === 0) {
    return <p className="px-6 py-16 text-center text-zinc-500">You have not blocked anyone. Blocked students cannot see you, and you cannot see them. They are never told.</p>;
  }
  const store = getObjectStore();
  const rows = await Promise.all(blocked.map(async (s) => ({ ...s, pictureUrl: s.avatarThumbKey ? await store.signedUrl(s.avatarThumbKey, PICTURE_LINK_SECONDS) : null })));

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((s) => (
        <li key={s.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2 dark:border-zinc-800">
          {s.pictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.pictureUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold dark:bg-zinc-800" aria-hidden>
              {(s.displayName || s.handle).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{s.displayName || `@${s.handle}`}</p>
            <p className="truncate text-sm text-zinc-500">@{s.handle}</p>
          </div>
          <UnblockButton handle={s.handle} />
        </li>
      ))}
    </ul>
  );
}
