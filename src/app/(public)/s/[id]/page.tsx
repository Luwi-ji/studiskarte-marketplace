import { cache, Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { getSignedInStudent } from "@/lib/access";
import { getObjectStore } from "@/lib/images/store";
import { getPublicShareCard, publicOrigin, type ShareCard } from "@/lib/posts/share-card";

const PHOTO_LINK_SECONDS = 30 * 60;
const DESCRIPTION = "On Studiskarte Marketplace, the student marketplace. Open the link to see it.";

/** A shared link is read by chat apps and crawlers, not only people: never index it, never follow from it. */
const ROBOTS = { index: false, follow: false };

/** The card for a post, or null, asked once per request however many parts of the page need it. */
const loadCard = cache(async (id: string): Promise<ShareCard | null> => {
  const parsed = z.uuid().safeParse(id);
  return parsed.success ? getPublicShareCard(parsed.data) : null;
});

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const { id } = await params;
  const card = await loadCard(id);
  if (!card) return { title: "Listing not available · Studiskarte Marketplace", robots: ROBOTS };
  // No seller anywhere, and no description of the listing beyond its title: this leaves the app.
  const title = `${card.title} - ${card.price}`;
  return {
    metadataBase: new URL(publicOrigin()),
    title,
    description: DESCRIPTION,
    robots: ROBOTS,
    openGraph: {
      type: "website",
      siteName: "Studiskarte Marketplace",
      title,
      description: DESCRIPTION,
      url: `/s/${id}`,
      images: [{ url: `/s/${id}/card`, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description: DESCRIPTION, images: [`/s/${id}/card`] },
  };
}

/**
 * What anyone sees at a shared listing link: the first photo, kind, price, title and school, and a button
 * into the app. Signed-in members go straight to the listing. It never shows the seller, the meet-up place,
 * the description, other photos or counts: the link can be pasted anywhere.
 */
export default function SharedListingPage({ params }: PageProps<"/s/[id]">) {
  return (
    <Suspense fallback={<Shell><PreviewSkeleton /></Shell>}>
      <Preview params={params} />
    </Suspense>
  );
}

async function Preview({ params }: { params: PageProps<"/s/[id]">["params"] }) {
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  // A signed-in member goes to the real listing (which tells its owner what happened to a withdrawn one).
  if (parsed.success && (await getSignedInStudent())) redirect(`/posts/${parsed.data}`);
  const card = await loadCard(id);
  if (!parsed.success || !card) return <Unavailable />;
  const photoUrl = await getObjectStore().signedUrl(card.photoKey, PHOTO_LINK_SECONDS);
  const wishlist = card.kind === "Wishlist";

  return (
    <Shell>
      {/* A short-lived signed link: next/image would route the private photo through the optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photoUrl} alt="Photo of the listing" className="aspect-[4/3] w-full rounded-2xl bg-zinc-100 object-cover dark:bg-zinc-800" fetchPriority="high" />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${wishlist ? "bg-amber-400 text-amber-950" : "bg-brand text-white"}`}>{card.kind}</span>
          {card.school ? <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{card.school}</span> : null}
        </div>
        <p className={`text-3xl font-bold ${wishlist ? "text-amber-700 dark:text-amber-300" : "text-brand-text"}`}>{card.price}</p>
        <h1 className="text-xl font-semibold leading-snug [overflow-wrap:anywhere]">{card.title}</h1>
      </div>
      <div className="flex flex-col gap-3">
        <Link href={`/sign-up?next=${encodeURIComponent(`/posts/${parsed.data}`)}`} className="flex min-h-12 w-full items-center justify-center rounded-lg bg-brand px-3 py-3 text-center text-base font-semibold text-white">
          Sign up to view
        </Link>
        <Link
          href={`/sign-in?next=${encodeURIComponent(`/posts/${parsed.data}`)}`}
          className="flex min-h-12 w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-3 text-center text-base font-medium text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          I have an account
        </Link>
      </div>
    </Shell>
  );
}

function Unavailable() {
  return (
    <Shell>
      <div className="flex flex-col gap-2 py-6 text-center">
        <h1 className="text-xl font-semibold">This listing is no longer available</h1>
        <p className="text-zinc-600 dark:text-zinc-400">It may have been withdrawn, finished or taken down.</p>
      </div>
      <div className="flex flex-col gap-1">
        <Link href="/" className="flex min-h-12 w-full items-center justify-center rounded-lg bg-brand px-3 py-3 text-center text-base font-semibold text-white">
          Open Studiskarte
        </Link>
        <CreateAccount />
      </div>
    </Shell>
  );
}

function CreateAccount() {
  return (
    <p className="text-center text-base text-zinc-600 dark:text-zinc-400">
      New here?{" "}
      <Link href="/sign-up" className="inline-flex min-h-11 items-center font-medium text-brand-text underline">
        Create an account
      </Link>
    </p>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 px-4 py-6">
      <header className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-10 w-10 rounded-xl" />
        <p className="text-lg font-semibold">Studiskarte Marketplace</p>
      </header>
      {children}
    </main>
  );
}

function PreviewSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-5 motion-safe:animate-pulse">
      <div className="aspect-[4/3] w-full rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-24 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-12 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}
