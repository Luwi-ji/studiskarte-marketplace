import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { HeartButton } from "@/components/heart-button";
import { ReviewPrompt } from "@/components/review-prompt";
import { SellerStats } from "@/components/seller-trust";
import { PostSkeleton } from "@/components/skeletons";
import { VerifiedBadge } from "@/components/verified-badge";
import { GuestBadge } from "@/components/guest-badge";
import { requireActiveStudent } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { getPostDetail } from "@/lib/posts/detail";
import { REPLY_LABEL } from "@/lib/messaging/response-time";
import { expiryNotice, formatAvailability, formatPrice, kindLabel, quantityLine, STATUS_LABEL } from "@/lib/posts/format";
import { unitsLeft } from "@/lib/deals/capacity";
import { offerLabels, offerOptions } from "@/lib/deals/rules";
import { RemindButton, RemindLink } from "@/components/reminder-host";
import { audienceRefusal } from "@/lib/posts/audience";
import { PAYMENT_LABEL } from "@/lib/payment";
import { CONDITION_LABEL, CONDITIONS } from "@/lib/posts/schema";
import { PhotoCarousel } from "./photo-carousel";
import { BackButton } from "./back-button";
import { BuyerShortcuts } from "./buyer-shortcuts";
import { ListingMenu } from "./listing-menu";
import { ViewTracker } from "./view-tracker";
import { ShareButton } from "@/app/posts/[id]/share-button";
import { MorePosts } from "@/app/posts/[id]/more-posts";
import { REPORT_REASONS } from "@/lib/safety/report";

export const metadata = { title: "Post · Studiskarte Marketplace" };

const PHOTO_LINK_SECONDS = 30 * 60;
const dayFormat = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" });
const dayYearFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" });
const yearFormat = new Intl.DateTimeFormat("en-PH", { year: "numeric", timeZone: "Asia/Manila" });

/** "Oct 17", with the year only when it is not this year: "Oct 17, 2027". */
function formatDay(date: Date): string {
  return yearFormat.format(date) === yearFormat.format(new Date()) ? dayFormat.format(date) : dayYearFormat.format(date);
}

export default function PostPage({ params, searchParams }: PageProps<"/posts/[id]">) {
  return (
    <Suspense fallback={<PostSkeleton />}>
      <Post params={params} searchParams={searchParams} />
    </Suspense>
  );
}

/** Two grey cards where "More from this seller" will be, so the page does not jump. */
function MorePostsSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-2 px-4 py-4 motion-safe:animate-pulse">
      <div className="aspect-square rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="aspect-square rounded-xl bg-zinc-200 dark:bg-zinc-800" />
    </div>
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

async function Post({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  // Someone who is not signed in (a shared link) signs in and lands back on this listing.
  const me = await requireActiveStudent(`/posts/${id.data}`);
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
  // Students can message about a post while it is open or reserved (never their own).
  const canMessage = !detail.isOwner && (detail.status === "open" || detail.status === "reserved");
  // Faculty, staff, alumni and visitors may only message, offer and reserve on a showcase that allows it.
  const studentsOnly = audienceRefusal({ role: me.role, kind: detail.kind, allowNonStudents: detail.allowNonStudents });
  // What they may do about the price: offer, reserve, both, or neither (a reserved post takes no offers).
  const options = offerOptions({ priceKind: detail.priceKind, postStatus: detail.status, postExpiresAt: detail.expiresAt, ownerStatus: "active", responderStatus: "active", unitsLeft: unitsLeft(detail.quantity, detail.unitsTaken), hasActiveDeal: detail.hasReservation, hasPendingOffer: detail.myTransaction?.state === "pending" });
  const howMany = quantityLine(detail.kind, detail.quantity, detail.unitsTaken);
  const labels = offerLabels(detail.kind);
  // Reserve and Make offer sit side by side only when neither is hidden; then one line says how they differ.
  const bothButtons = canMessage && !studentsOnly && !detail.myTransaction && options.offer && options.reserve;
  const justCreated = (await searchParams).created === "1";
  // "Post another" opens the form with this post's kind, place and payment already filled in.
  const again = new URLSearchParams();
  if (detail.exchangeMeetup && detail.meetupLocation) again.set("place", detail.meetupLocation);
  if (detail.paymentModes.length > 0) again.set("pay", detail.paymentModes.join(","));
  // The seller is the first thing a stranger weighs, so the card sits under the price, not at the bottom.
  const sellerWho = (
    <>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-lg font-semibold dark:bg-zinc-800" aria-hidden>
          {(detail.seller.displayName || detail.seller.handle || "?").slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="truncate font-medium">{detail.seller.displayName || `@${detail.seller.handle}`}</span>
          {detail.seller.isGuest ? <GuestBadge interactive={false} /> : <VerifiedBadge interactive={false} />}
        </p>
        {/* Stars and units sold sit beside the handle; the whole card is one link, so they are not links themselves. */}
        <div className="flex min-w-0 items-center gap-x-2 text-sm text-zinc-600 dark:text-zinc-400">
          {detail.seller.handle ? <span className="min-w-0 truncate text-zinc-500">@{detail.seller.handle}</span> : null}
          <span className="flex shrink-0 items-center gap-x-2">
            <SellerStats rating={detail.seller.rating} sold={detail.seller.sold} />
          </span>
        </div>
        {/* The whole school name, on its own line: it is what tells one school from another. */}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{detail.seller.school}</p>
      </div>
    </>
  );

  return (
    <main className={`mx-auto w-full max-w-md flex-1 ${detail.isOwner || canMessage ? (bothButtons ? "pb-[calc(8rem+env(safe-area-inset-bottom))]" : "pb-[calc(5rem+env(safe-area-inset-bottom))]") : "pb-[calc(1rem+env(safe-area-inset-bottom))]"}`}>
      {detail.isOwner && justCreated ? (
        <div role="status" className="flex flex-col gap-3 bg-brand/10 px-4 py-4">
          <p className="font-medium text-brand-text">Your post is live. Students at your school can see it now.</p>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/posts/new/${detail.kind}${again.size > 0 ? `?${again.toString()}` : ""}`} className="flex h-12 items-center justify-center rounded-lg bg-brand font-medium text-white active:opacity-80">
              Post another
            </Link>
            <Link href="/" className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 bg-white font-medium dark:border-zinc-700 dark:bg-zinc-900">
              View feed
            </Link>
          </div>
        </div>
      ) : null}
      {detail.isOwner && justCreated ? <ReviewPrompt momentKey={`posted:${detail.id}`} context="posted" /> : null}
      {detail.isOwner ? null : <ViewTracker postId={detail.id} />}
      <PhotoCarousel
        photos={photoUrls.map((url, i) => ({ url, caption: detail.photos[i].caption }))}
        title={detail.title}
        left={<BackButton href="/" />}
        right={
          <>
            {detail.isOwner || detail.status === "withdrawn" ? null : <HeartButton postId={detail.id} initial={detail.hearted} variant="overlay" />}
            <ShareButton postId={detail.id} />
            {detail.isOwner ? null : <ListingMenu postId={detail.id} sellerHandle={detail.seller.handle} sellerName={detail.seller.displayName || `@${detail.seller.handle}`} reasons={REPORT_REASONS} />}
          </>
        }
      />

      <div className="flex flex-col px-4">
        {detail.isOwner && detail.status === "open" && expiryNotice(detail.expiresAt).warn ? (
          <p className="mt-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {expiryNotice(detail.expiresAt).text}. Then it leaves the feed, and you can relist it from My posts.
          </p>
        ) : null}
        {detail.myTransaction?.state === "accepted" ? (
          <p className="mt-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {wishlist ? "You are supplying this. Next: agree a time and place for the handover in your messages." : "You reserved this. Next: agree a time and place for the handover in your messages. Do not pay before you and the seller have agreed them."}
          </p>
        ) : detail.status === "reserved" && !detail.isOwner ? (
          <p className="mt-4 rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Reserved. Someone else has a deal on this, but you can still message {wishlist ? "the poster" : "the seller"}.
          </p>
        ) : detail.status !== "open" ? (
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
        </div>
        <div className="flex flex-col gap-1 pb-4">
          <div className="mt-1 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 dark:bg-zinc-800">{kindLabel(detail.kind)}</span>
            {howMany ? <span className="rounded-full bg-brand/10 px-2.5 py-1 font-medium text-brand-text">{howMany}</span> : null}
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

        <section className="flex flex-col gap-1 border-t border-zinc-200 py-4 dark:border-zinc-800">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{wishlist ? "Posted by" : "Seller"}</h2>
          {/* A profile needs a handle; posts from before sign-up was finished have none. */}
          {detail.seller.handle ? (
            <Link href={`/u/${detail.seller.handle}?from=${detail.id}`} className="flex min-h-12 items-center gap-3 active:opacity-80">
              {sellerWho}
              <span aria-hidden className="text-xl text-zinc-400">›</span>
            </Link>
          ) : (
            <div className="flex items-center gap-3">{sellerWho}</div>
          )}
          {detail.seller.replies ? <p className="pl-15 text-sm text-zinc-600 dark:text-zinc-400">Replies {REPLY_LABEL[detail.seller.replies]}</p> : null}
        </section>

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
                <p className="text-zinc-600 dark:text-zinc-400">
                  {services
                    ? "Finished work is sent via third-party delivery apps like Grab or Lalamove."
                    : wishlist
                      ? "The poster wants it brought, via third-party delivery apps like Grab or Lalamove."
                      : "Use third-party delivery apps like Grab or Lalamove."}
                </p>
                <p className="text-xs text-zinc-500">Any delivery fee is agreed between you.</p>
              </li>
            ) : null}
          </ul>
        </Section>

        {detail.paymentModes.length > 0 ? (
          <Section title={wishlist ? "How they will pay" : "Payment"}>
            <p>{detail.paymentModes.map((mode) => PAYMENT_LABEL[mode]).join(", ")}</p>
            <p className="border-l-4 border-amber-500 pl-3 text-sm">
              <span className="font-medium">Do not pay before you and the other person have agreed a time and place for the handover.</span> The app never handles the money: you pay each other directly.
            </p>
          </Section>
        ) : null}

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

        <p className="border-t border-zinc-200 py-4 text-xs text-zinc-500 dark:border-zinc-800">
          Listed {formatDay(detail.listedAt)}
          {detail.status === "open" ? ` · Expires ${formatDay(detail.expiresAt)}` : ""}
          {detail.viewCount !== null ? ` · ${detail.viewCount} ${detail.viewCount === 1 ? "view" : "views"}` : ""}
          {detail.heartCount !== null ? ` · ${detail.heartCount} ${detail.heartCount === 1 ? "heart" : "hearts"}` : ""}
          {detail.pendingOffers ? ` · ${detail.pendingOffers} ${detail.pendingOffers === 1 ? "offer" : "offers"} waiting` : ""}
        </p>
      </div>

      <Suspense fallback={<MorePostsSkeleton />}>
        <MorePosts viewerId={me.id} postId={detail.id} ownerId={detail.ownerId} categoryId={detail.categoryId} />
      </Suspense>

      {canMessage ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-[var(--background)]/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-zinc-800">
          {studentsOnly ? (
            <div className="mx-auto flex max-w-md flex-col gap-2">
              <RemindButton trigger={wishlist ? "answer_wishlist" : "students_only_listing"} className="press flex h-12 items-center justify-center rounded-lg bg-brand font-medium text-white">
                {wishlist ? labels.reserve : "Message"}
              </RemindButton>
              <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">{studentsOnly}</p>
            </div>
          ) : detail.myTransaction ? (
            <BuyerShortcuts transaction={detail.myTransaction} />
          ) : (
            <>
              <div className="mx-auto flex max-w-md gap-2">
                {/* Message is the first step with a stranger, so it is the big blue button; offering and reserving come after talking. */}
                <Link href={`/messages/new?post=${detail.id}`} className="flex h-12 flex-[2] items-center justify-center rounded-lg bg-brand font-medium text-white">
                  Message
                </Link>
                {options.offer ? (
                  <RemindLink trigger={wishlist ? "answer_wishlist" : "students_only_listing"} href={`/offers/new?post=${detail.id}&type=offer`} className="flex h-12 flex-1 items-center justify-center whitespace-nowrap rounded-lg border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-700">
                    {labels.offer}
                  </RemindLink>
                ) : null}
                {options.reserve ? (
                  <RemindLink trigger={wishlist ? "answer_wishlist" : "students_only_listing"} href={`/offers/new?post=${detail.id}&type=reserve`} className="flex h-12 flex-1 items-center justify-center whitespace-nowrap rounded-lg border border-zinc-300 px-3 text-sm font-medium dark:border-zinc-700">
                    {labels.reserve}
                  </RemindLink>
                ) : null}
              </div>
              {bothButtons ? (
                <p className="mx-auto mt-2 max-w-md text-xs text-zinc-500">
                  {wishlist
                    ? `${labels.reserve}: say you can give them the item at their budget. ${labels.offer}: suggest a different price.`
                    : `${labels.reserve}: ask the seller to hold it at the asking price. ${labels.offer}: suggest a different price.`}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {detail.isOwner ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-[var(--background)]/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-zinc-800">
          <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
            <Link href={`/me?tab=${detail.kind}`} className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 font-medium dark:border-zinc-700">
              My posts
            </Link>
            {detail.editLocked ? (
              <span className="flex h-12 flex-col items-center justify-center rounded-lg border border-zinc-200 text-sm leading-tight text-zinc-500 dark:border-zinc-800">
                Edit locked
                <span className="text-[10px]">offers or reservations open</span>
              </span>
            ) : detail.status === "open" || detail.status === "expired" ? (
              <Link href={`/posts/${detail.id}/edit`} className="flex h-12 items-center justify-center rounded-lg bg-brand font-medium text-white">
                {detail.status === "expired" ? "Relist" : "Edit"}
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
