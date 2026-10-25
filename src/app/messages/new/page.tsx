import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { ProductCard } from "@/components/product-card";
import { RemindOnMount } from "@/components/reminder-host";
import { requireActiveStudent } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { getPostDetail } from "@/lib/posts/detail";
import { listingClosedReason } from "@/lib/messaging/rules";
import { audienceRefusal } from "@/lib/posts/audience";
import { NewMessage } from "./new-message";

export const metadata = { title: "New message · Studiskarte Marketplace" };

const LINK_SECONDS = 30 * 60;

export default function NewMessagePage({ searchParams }: PageProps<"/messages/new">) {
  return (
    <Suspense fallback={<PageHeader title="Message" back="/" />}>
      <NewMessageView searchParams={searchParams} />
    </Suspense>
  );
}

async function NewMessageView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireActiveStudent();
  const postId = z.uuid().safeParse((await searchParams).post);
  if (!postId.success) notFound();

  const detail = await getPostDetail(me.id, postId.data);
  if (!detail) notFound();
  if (detail.isOwner) redirect(`/posts/${detail.id}`);

  const closed =
    audienceRefusal({ role: me.role, kind: detail.kind, allowNonStudents: detail.allowNonStudents }) ??
    listingClosedReason({
      postStatus: detail.status,
      postExpiresAt: detail.expiresAt,
      ownerStatus: "active",
      responderStatus: "active",
    });
  const name = detail.seller.displayName || (detail.seller.handle ? `@${detail.seller.handle}` : "the seller");
  const thumbUrl = await getObjectStore().signedUrl(detail.photos[0].key, LINK_SECONDS);

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader title={`Message ${name}`} back={`/posts/${detail.id}`} />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-3 py-3">
        <ProductCard
          post={{ id: detail.id, title: detail.title, priceKind: detail.priceKind, priceAmount: detail.priceAmount, status: detail.status, thumbKey: detail.photos[0].key, kind: detail.kind }}
          thumbUrl={thumbUrl}
        />
        {audienceRefusal({ role: me.role, kind: detail.kind, allowNonStudents: detail.allowNonStudents }) ? <RemindOnMount trigger={detail.kind === "wishlist" ? "answer_wishlist" : "students_only_listing"} /> : null}
        <p className="flex-1 px-1 text-sm text-zinc-600 dark:text-zinc-400">
          {closed ? closed : "Your message goes only to the person who posted this, with this post attached. Meet in a public place, and pay in person."}
        </p>
        <div className="sticky bottom-0 border-t border-zinc-200 bg-[var(--background)] pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 dark:border-zinc-800">
          {closed ? (
            <Link href="/" className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 font-medium dark:border-zinc-700">
              Back to the feed
            </Link>
          ) : (
            <NewMessage postId={detail.id} place={detail.exchangeMeetup ? detail.meetupLocation : null} />
          )}
        </div>
      </main>
    </div>
  );
}
