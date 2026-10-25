import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LegalLinks } from "@/components/legal-links";
import { SettingsIcon, type SettingsIconName } from "@/components/settings-list";
import { SocialLinks } from "@/components/social-links";
import { FOUNDER, FOUNDING_SELLER_ENABLED, isFilled, QUOTES, SURVEY_N, TOP_FINDINGS } from "@/lib/landing/content";
import { SUPPORT_EMAIL } from "@/lib/support/config";
import { FunnelBeacon } from "./funnel-beacon";
import { PerkVote } from "./perk-vote";
import { FeedMock } from "./phone-mockups";

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

const FIXES: { problem: string; fix: string }[] = [
  { problem: "Buried posts", fix: "Your listing goes live right away. Buyers search by category, price or words like \"size M\", and students you follow come first." },
  { problem: "Waiting for admin approval", fix: "Post in seconds. There is no group admin to approve it." },
  { problem: "\"PM for price\"", fix: "Every listing shows a price, or says Free or Negotiable." },
  { problem: "Sold items still shown", fix: "Sold items leave the feed. What you see is open or reserved." },
  { problem: "Ghosting", fix: "Offers and reservations are cards in the chat, so both sides can see what was agreed." },
  { problem: "Can't trust sellers", fix: "School-email check, an optional ID checked badge, and reviews after real deals." },
  { problem: "Wrong size or no stock", fix: "Post a Wishlist: \"Looking for: PE uniform, size M\"." },
  { problem: "Meet-up hassle", fix: "A handover scheduler, daylight hours (6:00 AM to 8:00 PM) and one chat for the whole deal." },
];

const SAFETY: { icon: SettingsIconName; title: string; text: string }[] = [
  { icon: "school", title: "Verified students", text: "Every member confirms a school email with a code. A badge says exactly what was checked." },
  { icon: "shield", title: "Optional ID check", text: "Show a school ID to earn an ID checked badge. The pictures are deleted once it is decided." },
  { icon: "calendar", title: "Daylight meet-ups", text: "Handovers are set between 6:00 AM and 8:00 PM at a place you both agree on." },
  { icon: "user", title: "Your privacy", text: "Your email is never shown to other members." },
  { icon: "flag", title: "Report and block", text: "Report a listing or a person, or block them." },
];

const FAQ: { q: string; a: ReactNode }[] = [
  { q: "Does it cost anything?", a: "No. Studiskarte takes no fee from your sales, because it never handles the money." },
  {
    q: "How do I pay?",
    a: "In cash at the meet-up, or another way the listing allows, agreed between the two of you. Studiskarte never holds money and gives no payment protection, so do not pay before you have agreed a time and a place for the handover.",
  },
  { q: "Why TUP-Manila?", a: "We are launching there first. Students from any school can still join." },
  {
    q: "Who can join, and do I need a school email?",
    a: "Anyone aged 16 or older. Students, faculty, teachers, staff and alumni of any school join with their school email (it ends in .edu.ph), which also earns the School email badge. Without a school email you may be able to join as a Guest with a personal email; the sign-up page shows whether that is open. Guests can buy and post Wishlists but cannot sell.",
  },
  { q: "Is there an app to install?", a: "It is a web app. Open studiskarte.com in your phone's browser and choose Add to Home Screen." },
];

const PRIMARY = "press flex h-12 items-center justify-center rounded-full bg-white px-6 text-base font-semibold text-brand-strong";
const SECONDARY = "press flex h-12 items-center justify-center rounded-full border border-white/70 px-6 text-base font-semibold text-white";
const WRAP = "mx-auto w-full max-w-5xl px-5";
const MUTED = "text-zinc-600 dark:text-zinc-400";

export default function LandingPage() {
  // Evaluated while the page is prerendered: no photo file, no founder section.
  const showFounder = existsSync(join(process.cwd(), "public", FOUNDER.photoFile));
  const showFindings = TOP_FINDINGS.length > 0 && TOP_FINDINGS.every(isFilled);

  return (
    <div className="flex flex-1 flex-col">
      <FunnelBeacon />
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
              <p className="text-sm font-semibold uppercase tracking-wide text-white/90">For TUP-Manila students</p>
              <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">Your post got buried. Your product didn&apos;t deserve that.</h1>
              <p className="max-w-md text-lg text-white/90">
                One student marketplace for TUP-Manila where every listing is seen. Students from any school can join too.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/sign-up" className={PRIMARY}>
                  Join TUP-Manila&apos;s marketplace
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

        {showFounder ? (
          <section aria-labelledby="founder-heading" className={`${WRAP} flex flex-col gap-6 py-14`}>
            <h2 id="founder-heading" className="text-3xl font-bold tracking-tight">
              Why I built this
            </h2>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/${FOUNDER.photoFile}`}
                width={320}
                height={320}
                loading="lazy"
                decoding="async"
                alt={`${FOUNDER.name} (${FOUNDER.nickname}), the founder of Studiskarte`}
                className="aspect-square w-40 rounded-2xl object-cover"
              />
              <div className="flex max-w-xl flex-col gap-4 text-lg">
                <p>Ako si {FOUNDER.name}, o {FOUNDER.nickname}. I&apos;m a TUP-Manila student, and I sell empanada, pancakes and ice cream to support my studies.</p>
                <p>I lived the problem: posts get buried by social media algorithms, and posts in school groups wait for an admin to approve them.</p>
                <p>So I built the place I wished existed.</p>
                <p>Studiskarte is a marketplace for students: your listing goes live right away, students at your school can see it, and you agree a safe meet-up in one chat. Tara, mag-post na tayo.</p>
                <a href={FOUNDER.instagramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-base font-semibold underline">
                  Follow the journey: @{FOUNDER.instagramHandle} on Instagram<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            </div>
          </section>
        ) : null}

        <section aria-labelledby="quotes-heading" className="bg-zinc-50 py-14 dark:bg-zinc-900">
          <div className={`${WRAP} flex flex-col gap-6`}>
            <h2 id="quotes-heading" className="text-3xl font-bold tracking-tight">
              In students&apos; own words
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {QUOTES.map((quote) => (
                <blockquote key={quote} className="rounded-2xl border border-zinc-200 bg-white p-5 text-lg dark:border-zinc-800 dark:bg-zinc-950">
                  &ldquo;{quote}&rdquo;
                </blockquote>
              ))}
            </div>
            {isFilled(SURVEY_N) ? <p className={`text-sm ${MUTED}`}>{SURVEY_N}</p> : null}
            {showFindings ? (
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {TOP_FINDINGS.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="fixes-heading" className={`${WRAP} flex flex-col gap-6 py-14`}>
          <h2 id="fixes-heading" className="text-3xl font-bold tracking-tight">
            How Studiskarte fixes it
          </h2>
          <ul className="flex flex-col gap-3">
            {FIXES.map((item) => (
              <li key={item.problem} className="flex flex-col gap-1 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
                <p className={`text-sm font-semibold uppercase tracking-wide ${MUTED}`}>{item.problem}</p>
                <p className="text-lg">{item.fix}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="perks-heading" className="bg-zinc-50 py-14 dark:bg-zinc-900">
          <div className={`${WRAP} flex flex-col gap-4`}>
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="perks-heading" className="text-3xl font-bold tracking-tight">
                Student perks are coming
              </h2>
              <span className="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-brand-text">Coming soon</span>
            </div>
            <p className={`max-w-xl text-lg ${MUTED}`}>We want to bring student perks from local businesses. None are signed yet, so we are asking you first.</p>
            <h3 className="text-lg font-semibold">Which perks do you want?</h3>
            <PerkVote />
            <p className={`text-base ${MUTED}`}>
              Own a shop near campus?{" "}
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Student%20perk`} className="inline-flex min-h-11 items-center font-semibold underline">
                Message us
              </a>
              .
            </p>
          </div>
        </section>

        {FOUNDING_SELLER_ENABLED ? (
          <section aria-labelledby="founding-heading" className={`${WRAP} flex flex-col gap-2 py-14`}>
            <h2 id="founding-heading" className="text-3xl font-bold tracking-tight">
              Founding Seller
            </h2>
            <p className={`text-lg ${MUTED}`}>The first 100 members get a Founding Seller badge on their profile.</p>
          </section>
        ) : null}

        <section aria-labelledby="safety-heading" className={`${WRAP} flex flex-col gap-8 py-14`}>
          <h2 id="safety-heading" className="text-3xl font-bold tracking-tight">
            Verified students, safer meet-ups
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {SAFETY.map((item) => (
              <li key={item.title} className="flex gap-4 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand-text">
                  <SettingsIcon name={item.icon} />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className={MUTED}>{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="rounded-2xl bg-amber-100 p-5 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            <strong>Studiskarte never handles money and gives no payment protection.</strong> Do not pay before you and the other member have agreed a time and a place for the handover.
          </p>
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
            <h2 className="text-3xl font-bold tracking-tight">Tara, mag-post na!</h2>
            <Link href="/sign-up" className={PRIMARY}>
              Join TUP-Manila&apos;s marketplace
            </Link>
            <Link href="/sign-in" className="inline-flex min-h-11 items-center text-base underline">
              Already a member? Log in
            </Link>
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
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Child safety and urgent reports are read within 24 hours.</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Studiskarte Marketplace · Where student hustle meets student needs.</p>
        </div>
      </footer>
    </div>
  );
}
