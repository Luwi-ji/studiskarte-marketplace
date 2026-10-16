import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { getPostDetail } from "@/lib/posts/detail";
import { formatAvailability, formatPrice, STATUS_LABEL } from "@/lib/posts/format";
import { CONDITION_LABEL, CONDITIONS } from "@/lib/posts/schema";
import { PhotoCarousel } from "./photo-carousel";

export const metadata = { title: "Post · Studiskarte Marketplace" };

const PHOTO_LINK_SECONDS = 30 * 60;
const dateFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });

export default function PostPage({ params }: PageProps<"/posts/[id]">) {
  return (
    <>
      <PageHeader title="Post" back="/" />
      <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
        <Post params={params} />
      </Suspense>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-zinc-200 py-4 dark:border-zinc-800">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

async function Post({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireActiveStudent();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const detail = await getPostDetail(me.id, id.data);
  if (!detail) notFound();

  const store = getObjectStore();
  const [photoUrls, avatarUrl] = await Promise.all([
    Promise.all(detail.photos.map((p) => store.signedUrl(p.key, PHOTO_LINK_SECONDS))),
    detail.seller.avatarThumbKey ? store.signedUrl(detail.seller.avatarThumbKey, PHOTO_LINK_SECONDS) : null,
  ]);
  const wishlist = detail.kind === "wishlist";
  const services = detail.categoryId === "services";
  const condition = CONDITIONS.find((c) => c === detail.condition);

  return (
    <main className={`mx-auto w-full max-w-md flex-1 ${detail.isOwner ? "pb-[calc(5rem+env(safe-area-inset-bottom))]" : "pb-[calc(1rem+env(safe-area-inset-bottom))]"}`}>
      <PhotoCarousel photos={photoUrls.map((url, i) => ({ url, caption: detail.photos[i].caption }))} title={detail.title} />

      <div className="flex flex-col px-4">
        {detail.status !== "open" ? (
          <p className="mt-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {STATUS_LABEL[detail.status] ?? detail.status}
            {detail.status === "reserved" ? " – someone has a deal on this." : ""}
          </p>
        ) : null}

        <div className="flex flex-col gap-1 py-4">
          <p className="text-2xl font-bold">
            {wishlist && detail.priceKind === "amount" ? "Budget " : ""}
            {formatPrice(detail.priceKind, detail.priceAmount)}
          </p>
          <h1 className="text-xl font-semibold leading-snug">{detail.title}</h1>
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">{wishlist ? "Wanted" : "Offered"}</span>
            {condition ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
                {wishlist ? "Wants: " : ""}
                {CONDITION_LABEL[condition]}
              </span>
            ) : null}
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">
              {detail.categoryName}
            </span>
          </div>
        </div>

        <Section title="Description">
          <p className="whitespace-pre-line leading-relaxed">{detail.description}</p>
        </Section>

        <Section title={wishlist ? "How they'd like to receive it" : "How to get it"}>
          <ul className="flex flex-col gap-3">
            {detail.exchangeMeetup ? (
              <li>
                <p className="font-medium">{services ? "In person" : "Meet-up"}</p>
                <p className="text-zinc-600 dark:text-zinc-400">{detail.meetupLocation}</p>
              </li>
            ) : null}
            {detail.exchangeDelivery ? (
              <li>
                <p className="font-medium">Delivery</p>
                <p className="text-zinc-600 dark:text-zinc-400">{detail.deliveryArea}</p>
                <p className="text-xs text-zinc-500">
                  {services
                    ? "Finished work is handed over or sent."
                    : wishlist
                      ? "Brought by the seller, or sent by Grab, Lalamove and similar."
                      : "The seller brings it, or sends it by Grab, Lalamove and similar."}{" "}
                  Any delivery fee is agreed between you.
                </p>
              </li>
            ) : null}
          </ul>
        </Section>

        <Section title="Available">
          <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
            {detail.availability.map((entry) => {
              const { day, time } = formatAvailability(entry);
              return (
                <li key={day} className="flex justify-between gap-4 py-2">
                  <span>{day}</span>
                  <span className="text-zinc-600 dark:text-zinc-400">{time}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-zinc-500">Philippine time.</p>
        </Section>

        <Section title={wishlist ? "Posted by" : "Seller"}>
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold dark:bg-zinc-800" aria-hidden>
                {(detail.seller.displayName || detail.seller.handle || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium">{detail.seller.displayName || `@${detail.seller.handle}`}</p>
              <p className="truncate text-sm text-zinc-500">
                {detail.seller.handle ? `@${detail.seller.handle} · ` : ""}
                {detail.seller.school}
              </p>
            </div>
          </div>
        </Section>

        <p className="border-t border-zinc-200 py-4 text-xs text-zinc-500 dark:border-zinc-800">
          Listed {dateFormat.format(detail.listedAt)}
          {detail.status === "open" ? ` · Expires ${dateFormat.format(detail.expiresAt)}` : ""}
        </p>
      </div>

      {detail.isOwner ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-[var(--background)]/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-zinc-800">
          <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
            <Link href="/me/posts" className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 font-medium dark:border-zinc-700">
              My posts
            </Link>
            {detail.status === "open" ? (
              <Link href={`/posts/${detail.id}/edit`} className="flex h-12 items-center justify-center rounded-lg bg-brand font-medium text-white">
                Edit
              </Link>
            ) : (
              <span className="flex h-12 items-center justify-center rounded-lg border border-zinc-200 text-sm text-zinc-500 dark:border-zinc-800">
                Can&apos;t be edited
              </span>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
