import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { ProductCard } from "@/components/product-card";
import { requireActiveStudent } from "@/lib/access";
import { unitsLeft } from "@/lib/deals/capacity";
import { offerLabels, offerOptions } from "@/lib/deals/rules";
import { getObjectStore } from "@/lib/images/store";
import { getPostDetail } from "@/lib/posts/detail";
import { audienceRefusal } from "@/lib/posts/audience";
import { formatPrice } from "@/lib/posts/format";
import { OfferForm } from "./offer-form";

export const metadata = { title: "Offer · Studiskarte Marketplace" };

const LINK_SECONDS = 30 * 60;

export default function NewOfferPage({ searchParams }: PageProps<"/offers/new">) {
  return (
    <Suspense fallback={<PageHeader title="Offer" back="/" />}>
      <NewOffer searchParams={searchParams} />
    </Suspense>
  );
}

async function NewOffer({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireActiveStudent();
  const params = await searchParams;
  const postId = z.uuid().safeParse(params.post);
  if (!postId.success) notFound();
  const kind = params.type === "reserve" ? "reserve" : "offer";

  const detail = await getPostDetail(me.id, postId.data);
  if (!detail) notFound();
  if (detail.isOwner) redirect(`/posts/${detail.id}`);

  const options = offerOptions({
    priceKind: detail.priceKind,
    postStatus: detail.status,
    postExpiresAt: detail.expiresAt,
    ownerStatus: "active",
    responderStatus: "active",
    unitsLeft: unitsLeft(detail.quantity, detail.unitsTaken),
    hasActiveDeal: detail.hasReservation,
    hasPendingOffer: detail.myTransaction?.state === "pending",
  });
  const labels = offerLabels(detail.kind);
  const studentsOnly = audienceRefusal({ role: me.role, kind: detail.kind, allowNonStudents: detail.allowNonStudents });
  const allowed = !studentsOnly && (kind === "reserve" ? options.reserve : options.offer);
  const thumbUrl = await getObjectStore().signedUrl(detail.photos[0].key, LINK_SECONDS);
  const price = formatPrice(detail.priceKind, detail.priceAmount);
  const askingText =
    kind === "reserve"
      ? detail.priceKind === "free"
        ? "This post is free. Reserve it to ask the owner to hold it for you."
        : `Reserve at ${price}. The owner can accept to hold it for you.`
      : detail.priceKind === "negotiable"
        ? "The owner has not named a price."
        : `Asking price: ${price}.`;

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader title={kind === "reserve" ? labels.reserve : labels.offer} back={`/posts/${detail.id}`} />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-3 py-3">
        <ProductCard
          post={{ id: detail.id, title: detail.title, priceKind: detail.priceKind, priceAmount: detail.priceAmount, status: detail.status, thumbKey: detail.photos[0].key, kind: detail.kind }}
          thumbUrl={thumbUrl}
        />
        {allowed ? (
          <OfferForm
            postId={detail.id}
            postKind={detail.kind === "wishlist" ? "wishlist" : "showcase"}
            kind={kind}
            askingText={askingText}
            maxQuantity={options.maxQuantity}
            limited={detail.quantity !== null}
            unitPrice={detail.priceAmount}
          />
        ) : (
          <div className="flex flex-col gap-4 py-6 text-center">
            <p className="text-zinc-600 dark:text-zinc-400">{studentsOnly ?? options.reason ?? (kind === "reserve" ? "This post has no price to reserve at. Make an offer instead." : "This post is free. Reserve it instead.")}</p>
            <Link href={`/posts/${detail.id}`} className="mx-auto flex h-12 items-center rounded-lg border border-zinc-300 px-6 font-medium dark:border-zinc-700">
              Back to the post
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
