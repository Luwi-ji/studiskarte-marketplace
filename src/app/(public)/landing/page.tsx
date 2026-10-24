import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LegalLinks } from "@/components/legal-links";
import { SettingsIcon, type SettingsIconName } from "@/components/settings-list";
import { SocialLinks } from "@/components/social-links";
import { SUPPORT_EMAIL } from "@/lib/support/config";
import { FeedMock, ThreadMock } from "./phone-mockups";

const TITLE = "Studiskarte Marketplace · Where student hustle meets student needs";
const DESCRIPTION =
  "Buy, sell, give away and look for things inside your school community. Chat, agree a time and a public place, and hand it over. Free to use, tied to your school email, and we never handle your money.";

// The page is served at studiskarte.com for anyone who is not signed in (see src/proxy.ts); this is its own address too.
export const metadata: Metadata = {
  metadataBase: new URL("https://studiskarte.com"),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/", siteName: "Studiskarte Marketplace", type: "website", images: [{ url: "/logo.png" }] },
};

// The top-level categories, as the app names them.
const CATEGORIES = [
  "Textbooks & Study Materials",
  "School & Office Supplies",
  "Uniforms & Org Merch",
  "Electronics & Gadgets",
  "Dorm & Living Essentials",
  "Clothing & Accessories",
  "Hobbies & Entertainment",
  "Transportation",
  "Housing & Bedspace",
  "Food & Treats",
  "Services",
];

const STEPS = [
  { title: "Join with your school email", text: "We send a code to confirm it, then you choose a password. It takes a minute." },
  { title: "Post or browse", text: "Showcase what you offer, or add what you are looking for to your Wishlist. Filter by school, category and price." },
  { title: "Agree and hand over", text: "Chat, make an offer or reserve, agree a time and a public place, confirm the handover and leave a review." },
];

const SAFETY: { icon: SettingsIconName; title: string; text: string }[] = [
  { icon: "calendar", title: "Daylight meet-ups", text: "Handovers are set between 6:00 AM and 8:00 PM, at a place you both agree on." },
  { icon: "school", title: "Tied to a school email", text: "Every member confirms an email with a code. The badge says exactly what was checked." },
  { icon: "shield", title: "Optional ID check", text: "Members can show a school ID to earn an ID checked badge. The pictures are deleted once it is decided." },
  { icon: "flag", title: "Report and block", text: "Report a listing or a person, or block them. Child safety and urgent reports are read within 24 hours." },
];

const FAQ: { q: string; a: ReactNode }[] = [
  { q: "Does it cost anything?", a: "No. Studiskarte takes no fee from your sales, because it never handles the money." },
  {
    q: "How do I pay?",
    a: "In cash at the meet-up, or another way the listing allows, agreed between the two of you. Studiskarte never holds money and gives no payment protection, so do not pay before you have agreed a time and a place for the handover.",
  },
  {
    q: "Who can join?",
    a: "Anyone aged 16 or older. Students post Showcase listings. Faculty, teachers, staff and alumni can look for things and post Wishlists, and buy from a Showcase when the seller allows it.",
  },
  {
    q: "I do not have a school email. Can I join?",
    a: (
      <>
        A school email is the main way in. The sign-up page shows what is open right now, or write to{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
          {SUPPORT_EMAIL}
        </a>
        .
      </>
    ),
  },
  { q: "Is there an app to install?", a: "It is a web app. Open studiskarte.com in your phone's browser and choose Add to Home Screen." },
];

const PRIMARY = "press flex h-12 items-center justify-center rounded-full bg-white px-6 text-base font-semibold text-brand-strong";
const SECONDARY = "press flex h-12 items-center justify-center rounded-full border border-white/70 px-6 text-base font-semibold text-white";
const WRAP = "mx-auto w-full max-w-5xl px-5";

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 fill-none stroke-brand-text" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-brand pt-[env(safe-area-inset-top)] text-white">
        <div className={`${WRAP} flex h-16 items-center justify-between`}>
          <Link href="/" className="flex items-center gap-2.5" aria-label="Studiskarte">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 rounded-xl" />
            <span className="text-lg font-bold">Studiskarte</span>
          </Link>
          <nav aria-label="Account" className="flex items-center gap-2">
            <Link href="/sign-in" className="press flex h-11 items-center rounded-full px-4 text-base font-semibold">
              Log in
            </Link>
            <Link href="/sign-up" className="press hidden h-11 items-center rounded-full bg-white px-4 text-base font-semibold text-brand-strong sm:flex">
              Create an account
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="overflow-hidden bg-brand pb-0 text-white">
          <div className={`${WRAP} grid items-center gap-10 pb-0 pt-8 md:grid-cols-2 md:pb-14 md:pt-14`}>
            <div className="flex flex-col gap-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-white/90">For students in the Philippines</p>
              <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">Where student hustle meets student needs.</h1>
              <p className="max-w-md text-lg text-white/90">
                Buy, sell, give away and look for things inside your school community. Chat, agree a time and a public place, and hand it over.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/sign-up" className={PRIMARY}>
                  Create an account
                </Link>
                <Link href="/sign-in" className={SECONDARY}>
                  Log in
                </Link>
              </div>
              <ul className="flex flex-col gap-1.5 text-sm text-white/90">
                <li>Free to use, with no selling fees</li>
                <li>Tied to your school email</li>
                <li>We never handle your money</li>
              </ul>
            </div>
            <div className="relative -mb-24 mt-2 h-[22rem] overflow-hidden md:mb-0 md:mt-0 md:h-auto md:overflow-visible">
              <FeedMock className="md:rotate-2" />
            </div>
          </div>
        </section>

        <section aria-label="What you can find" className="overflow-hidden border-b border-zinc-200 bg-zinc-50 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="marquee-track flex gap-2 px-5">
            {[...CATEGORIES, ...CATEGORIES].map((name, i) => (
              <span key={i} aria-hidden={i >= CATEGORIES.length} className="shrink-0 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                {name}
              </span>
            ))}
          </div>
        </section>

        <section className={`${WRAP} flex flex-col gap-8 py-14`}>
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-bold tracking-tight">Join your school in minutes</h2>
            <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">Three steps from sign-up to a finished handover.</p>
          </div>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-2 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-base font-bold text-white">{i + 1}</span>
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="text-zinc-600 dark:text-zinc-400">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="bg-zinc-50 py-14 dark:bg-zinc-900">
          <div className={`${WRAP} grid items-center gap-10 md:grid-cols-2`}>
            <div className="order-2 md:order-1">
              <ThreadMock />
            </div>
            <div className="order-1 flex flex-col gap-4 md:order-2">
              <h2 className="text-3xl font-bold tracking-tight">The whole deal lives in one chat</h2>
              <p className="text-lg text-zinc-600 dark:text-zinc-400">No jumping between apps to agree a price, a place and a time.</p>
              <ul className="flex flex-col gap-3">
                {[
                  "Offers and reservations show up as cards in the conversation.",
                  "Agree a time and place in the app, and add the handover to your calendar.",
                  "Both of you confirm the handover, then leave each other a review.",
                ].map((line) => (
                  <li key={line} className="flex gap-3">
                    <Check />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className={`${WRAP} flex flex-col gap-8 py-14`}>
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-bold tracking-tight">Built to meet strangers safely</h2>
            <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">The person on the other side is usually someone from your school you have not met. The product is designed around that.</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {SAFETY.map((item) => (
              <li key={item.title} className="flex gap-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand-text">
                  <SettingsIcon name={item.icon} />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="text-zinc-600 dark:text-zinc-400">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="rounded-2xl bg-amber-100 p-5 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            <strong>Studiskarte never handles money and gives no payment protection.</strong> Do not pay before you and the other member have agreed a time and a place for the handover.
          </p>
        </section>

        <section className="bg-zinc-50 py-14 dark:bg-zinc-900">
          <div className={`${WRAP} flex flex-col gap-8`}>
            <div className="flex flex-col gap-2">
              <h2 className="text-3xl font-bold tracking-tight">Made for the whole school community</h2>
              <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">Every member has a role, and the badge on a profile says what was checked.</p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              <li className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-lg font-semibold">Students</h3>
                <p className="text-zinc-600 dark:text-zinc-400">Post Showcase listings to sell, give away or offer a service, and post Wishlists for what you need.</p>
              </li>
              <li className="flex flex-col gap-1 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                <h3 className="text-lg font-semibold">Faculty, staff and alumni</h3>
                <p className="text-zinc-600 dark:text-zinc-400">Look for things, post Wishlists, and buy from a Showcase when the seller allows non-students.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className={`${WRAP} flex flex-col gap-6 py-14`}>
          <h2 className="text-3xl font-bold tracking-tight">Questions</h2>
          <div className="flex flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-base font-semibold [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-none stroke-zinc-500 transition-transform duration-150 group-[[open]]:rotate-90 motion-reduce:transition-none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </summary>
                <p className="pb-4 text-zinc-700 dark:text-zinc-300">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="bg-brand text-white">
          <div className={`${WRAP} flex flex-col items-center gap-5 py-14 text-center`}>
            <h2 className="text-3xl font-bold tracking-tight">Ready to start?</h2>
            <p className="max-w-md text-lg text-white/90">Join your school&apos;s marketplace. Tara, mag-post na!</p>
            <div className="flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
              <Link href="/sign-up" className={PRIMARY}>
                Create an account
              </Link>
              <Link href="/sign-in" className={SECONDARY}>
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 py-10 dark:border-zinc-800">
        <div className={`${WRAP} flex flex-col items-center gap-6 text-center`}>
          <div className="flex flex-col items-center gap-3">
            <p className="font-semibold">Follow Studiskarte for updates, tips and new features</p>
            <SocialLinks className="w-full max-w-xs" />
          </div>
          <nav aria-label="More" className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            <Link href="/about" className="inline-flex min-h-11 items-center underline">
              About
            </Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex min-h-11 items-center underline">
              {SUPPORT_EMAIL}
            </a>
          </nav>
          <LegalLinks />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Studiskarte Marketplace · Where student hustle meets student needs.</p>
        </div>
      </footer>
    </div>
  );
}
