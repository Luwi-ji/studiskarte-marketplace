import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SettingsIcon, type SettingsIconName } from "@/components/settings-list";
import { SocialLinks } from "@/components/social-links";
import { FOUNDER, FOUNDING_USER_ENABLED, isFilled, QUOTES, SURVEY_N, TOP_FINDINGS } from "@/lib/landing/content";
import { currentLegal, LEGAL_SLUGS, LEGAL_TITLES } from "@/lib/legal/documents";
import { FACEBOOK_URL, INSTAGRAM_URL, SUPPORT_EMAIL } from "@/lib/support/config";
import { BackToTop } from "./back-to-top";
import { ContactDrawer } from "./contact-drawer";
import { CookieModal, CookieSettingsButton } from "./cookie-modal";
import { FunnelBeacon } from "./funnel-beacon";
import { PerkVote } from "./perk-vote";
import { FeedMock, ScreenPhone } from "./phone-mockups";

const TITLE = "Studiskarte";
const DESCRIPTION =
  "Buy, sell, give away and look for things inside your school community. Chat, agree a time and a public place, and hand it over. Free to use, tied to your school email, and we never handle your money.";

// The page is served at studiskarte.com for anyone who is not signed in (see src/proxy.ts); this is its own address too.
export const metadata: Metadata = {
  metadataBase: new URL("https://studiskarte.com"),
  title: { absolute: TITLE },
  description: DESCRIPTION,
  applicationName: "Studiskarte",
  keywords: ["student marketplace", "buy and sell for students", "Philippines student marketplace", "school email marketplace", "student wishlist", "Studiskarte"],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    siteName: "Studiskarte",
    type: "website",
    locale: "en_PH",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Studiskarte: where student hustle meets student needs" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og.png"] },
};

// What search engines read to show the name, logo and links under a result: who we are, and the site itself.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://studiskarte.com/#organization",
      name: "Studiskarte",
      alternateName: "Studiskarte Marketplace",
      url: "https://studiskarte.com/",
      logo: "https://studiskarte.com/logo.png",
      email: SUPPORT_EMAIL,
      sameAs: [FACEBOOK_URL, INSTAGRAM_URL],
    },
    {
      "@type": "WebSite",
      "@id": "https://studiskarte.com/#website",
      url: "https://studiskarte.com/",
      name: "Studiskarte",
      alternateName: "Studiskarte Marketplace",
      description: DESCRIPTION,
      inLanguage: "en-PH",
      publisher: { "@id": "https://studiskarte.com/#organization" },
    },
  ],
};

// Real screens from the app. Every claim in a caption is something the screen shows.
const SCREENS = [
  { src: "/landing/app-post.webp", height: 900, title: "Post in seconds", alt: "The Studiskarte post form with a photo, title and price filled in", text: "Add photos, a price and when you can meet. No admin to approve it." },
  { src: "/landing/app-filters.webp", height: 800, title: "Find it fast", alt: "The Studiskarte filters: school, sort, type, category, condition, price and date listed", text: "Search, then filter by school, category, condition, price and date listed." },
  { src: "/landing/app-meetup.webp", height: 743, title: "Agree the handover", alt: "A Studiskarte chat where the seller picks a day, time and place to hand over", text: "Pick the day, time and place in the chat, between 6:00 AM and 8:00 PM." },
  { src: "/landing/app-profile.webp", height: 900, title: "Build trust", alt: "A Studiskarte profile with badges, a star rating and listings", text: "Your profile shows your badges and the reviews from completed deals." },
  { src: "/landing/app-myposts.webp", height: 900, title: "Keep track", alt: "The My posts screen listing each post with its status, views and hearts", text: "See what is open, reserved or finished, with views and hearts, and open any post to edit it." },
];

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
  { q: "Is Studiskarte part of a school?", a: "No. Studiskarte is independent and is not affiliated with any school. Your school email only shows that you are a student." },
  {
    q: "Who can join, and do I need a school email?",
    a: "Anyone aged 16 or older. Students, faculty, teachers, staff and alumni of any school join with their school email (it ends in .edu.ph), which also earns the School email badge. Without a school email you may be able to join as a Guest with a personal email; the sign-up page shows whether that is open. Guests can buy and post Wishlists but cannot sell.",
  },
  { q: "Is there an app to install?", a: "It is a web app. Open studiskarte.com in your phone's browser and choose Add to Home Screen." },
];

const PRIMARY = "press flex min-h-12 items-center justify-center rounded-full bg-white px-7 text-base font-semibold text-brand-strong shadow-sm";
const SECONDARY = "press flex min-h-12 items-center justify-center rounded-full border border-white/60 px-7 text-base font-semibold text-white";
const SOLID = "press flex min-h-12 items-center justify-center rounded-full bg-brand px-7 text-base font-semibold text-white";
const WRAP = "mx-auto w-full max-w-5xl px-5";
const SECTION = "py-16 sm:py-20";
const MUTED = "text-zinc-600 dark:text-zinc-400";
const CARD = "rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950";

function Heading({ id, eyebrow, title, children }: { id: string; eyebrow?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3">
      {eyebrow ? <div className="text-sm font-semibold uppercase tracking-wide text-brand-text">{eyebrow}</div> : null}
      <h2 id={id} className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        {title}
      </h2>
      {children ? <p className={`max-w-2xl text-pretty text-lg ${MUTED}`}>{children}</p> : null}
    </div>
  );
}

function Tick({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 fill-none stroke-current ${className}`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  );
}

export default function LandingPage() {
  // Evaluated while the page is prerendered: no photo file, no founder section.
  const showFounder = existsSync(join(process.cwd(), "public", FOUNDER.photoFile));
  const showFindings = TOP_FINDINGS.length > 0 && TOP_FINDINGS.every((item) => isFilled(item.figure) && isFilled(item.text));
  const legal = currentLegal();

  return (
    <div id="top" className="flex flex-1 flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
      <FunnelBeacon />
      <CookieModal />
      <BackToTop />

      {/* A pill that floats over the page: zero height, so the hero starts at the very top. */}
      <header className="sticky top-0 z-40 h-0 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto w-full max-w-5xl px-3 pt-3">
          <div className="flex h-14 items-center justify-between rounded-full bg-brand/90 pl-4 pr-2 text-white shadow-lg ring-1 ring-white/20 backdrop-blur-md">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Studiskarte">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-64.webp" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
              <span className="text-lg font-bold">Studiskarte</span>
            </Link>
            <nav aria-label="Account" className="flex items-center gap-1">
              <Link href="/sign-in" className="press flex h-11 items-center rounded-full px-4 text-base font-semibold">
                Log in
              </Link>
              <Link href="/sign-up" className="press flex h-10 items-center rounded-full bg-white px-5 text-base font-semibold text-brand-strong">
                Join
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="overflow-hidden rounded-b-[2.5rem] bg-brand text-white">
          <div className={`${WRAP} grid items-center gap-12 pb-16 pt-28 md:grid-cols-2 md:pb-20 md:pt-32`}>
            <div className="flex flex-col items-start gap-6">
              <p className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold">Open to all students</p>
              <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">Student hustle meets student needs.</h1>
              <p className="max-w-md text-pretty text-lg text-white/90">
                Post in a minute and get seen by your own campus. Made by a student seller who got tired of waiting for admin approval.
              </p>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Link href="/sign-up" className={PRIMARY}>
                  Join Studiskarte
                </Link>
                <Link href="/sign-in" className={SECONDARY}>
                  Log in
                </Link>
              </div>
              <ul className="flex flex-col gap-2 text-base text-white/90">
                {["Free to use, with no selling fees", "Tied to your school email", "We never handle your money"].map((line) => (
                  <li key={line} className="flex items-center gap-2.5">
                    <Tick className="text-white" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">
              <FeedMock className="md:rotate-2" />
            </div>
          </div>
        </section>

        {/* Founder story */}
        {showFounder ? (
          <section aria-labelledby="founder-heading" className={SECTION}>
            <div className={`${WRAP} grid gap-10 md:grid-cols-[auto_1fr] md:gap-14`}>
              <div className="flex flex-col items-start gap-4 md:sticky md:top-28 md:self-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/${FOUNDER.photoFile}`}
                  width={320}
                  height={320}
                  loading="lazy"
                  decoding="async"
                  alt={`${FOUNDER.name} (${FOUNDER.nickname}), the founder of Studiskarte`}
                  className="aspect-square w-44 rounded-3xl object-cover shadow-lg sm:w-56"
                />
                <div className="flex flex-col">
                  <p className="text-lg font-bold">{FOUNDER.nickname}</p>
                  <p className={MUTED}>Founder, student seller</p>
                </div>
                <a href={FOUNDER.instagramUrl} target="_blank" rel="noopener noreferrer" className="press inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-4 text-base font-semibold dark:border-zinc-700">
                  @{FOUNDER.instagramHandle} on Instagram<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>

              <div className="flex max-w-xl flex-col gap-6">
                <Heading id="founder-heading" eyebrow="The story" title="Why I built this" />
                <p className="text-xl">
                  Ako si {FOUNDER.nickname}, estudyanteng komsay in Manila, and I sell empanada, pancakes and ice cream-dy to support my studies.
                </p>
                <blockquote className="border-l-4 border-brand pl-5 text-2xl font-bold leading-snug tracking-tight">
                  The hard part was never the preparation of the products I sell, because I love the idea of selling. It was being seen and getting traction on what I sell.
                </blockquote>
                <div className="flex flex-col gap-2 text-lg">
                  <p>Posts sank. Group posts waited for admin approval.</p>
                  <p>I asked other students and they said the same.</p>
                </div>
                <p className="text-lg">So I&apos;m building Studiskarte. One place for students to buy, sell and discover.</p>
                <ul className="flex flex-col gap-2.5 text-lg">
                  {["No admin approval", "Search and filters, so listings get found", "Verified school emails", "Perks from local businesses are coming"].map((line) => (
                    <li key={line} className="flex items-start gap-3">
                      <Tick className="mt-1 text-brand-text" />
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="text-lg font-semibold">Be one of the first sellers. Simulan na natin.</p>
                <Link href="/sign-up" className={`${SOLID} self-start`}>
                  Join Studiskarte
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {/* Students' own words */}
        <section aria-labelledby="quotes-heading" className={`${SECTION} bg-zinc-50 dark:bg-zinc-900`}>
          <div className={`${WRAP} flex flex-col gap-10`}>
            <Heading id="quotes-heading" eyebrow="The problem" title="In students' own words">
              {isFilled(SURVEY_N) ? SURVEY_N : undefined}
            </Heading>
            {showFindings ? (
              <ul className="grid gap-4 sm:grid-cols-3">
                {TOP_FINDINGS.map((item) => (
                  <li key={item.figure} className={`${CARD} flex flex-col gap-1 p-6`}>
                    <p className="text-4xl font-bold tracking-tight text-brand-text">{item.figure}</p>
                    <p className={MUTED}>{item.text}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              {QUOTES.map((quote, i) => (
                <blockquote key={quote} className={`${CARD} relative flex gap-4 p-6 text-lg ${i === 0 ? "md:col-span-2" : ""}`}>
                  <span aria-hidden className="text-4xl font-bold leading-none text-brand-text">&ldquo;</span>
                  <p className="text-pretty">{quote}</p>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* How it fixes it */}
        <section aria-labelledby="fixes-heading" className={SECTION}>
          <div className={`${WRAP} flex flex-col gap-12`}>
            <Heading id="fixes-heading" eyebrow="How it works" title="How Studiskarte fixes it">
              Real screens from the app. Swipe through them, then see what each problem looks like once you are on it.
            </Heading>
            {/* On a phone the screens scroll sideways; on a wide screen all five sit in one row. */}
            <ol className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4 lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-4 lg:overflow-visible lg:px-0">
              {SCREENS.map((screen, i) => (
                <li key={screen.src} className="flex w-[13.5rem] shrink-0 snap-center flex-col gap-4 lg:w-auto">
                  <ScreenPhone src={screen.src} alt={screen.alt} height={screen.height} />
                  <div className="flex flex-col gap-1">
                    <p className="flex items-center gap-2 text-base font-bold">
                      <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs text-white">
                        {i + 1}
                      </span>
                      {screen.title}
                    </p>
                    <p className={`text-sm ${MUTED}`}>{screen.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="flex flex-col gap-5">
              <h3 className="text-xl font-bold tracking-tight">Problems you know, answered</h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {FIXES.map((item) => (
                  <li key={item.problem} className={`${CARD} flex gap-3 p-5`}>
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand-text" aria-hidden>
                      <Tick className="h-4 w-4" />
                    </span>
                    <div className="flex flex-col gap-1">
                      <p className={`text-sm font-medium ${MUTED}`}>
                        <span className="sr-only">Problem: </span>
                        {item.problem}
                      </p>
                      <p className="text-base font-medium">
                        <span className="sr-only">Fix: </span>
                        {item.fix}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Perks */}
        <section aria-labelledby="perks-heading" className={`${SECTION} bg-zinc-50 dark:bg-zinc-900`}>
          <div className={`${WRAP} flex flex-col gap-10`}>
            <Heading
              id="perks-heading"
              eyebrow={<span className="inline-flex rounded-full bg-brand/10 px-3 py-1 text-brand-text">Coming soon</span>}
              title="Student perks"
            >
              We are asking local shops for discounts for students. The first one is already here.
            </Heading>
            <div className="grid items-stretch gap-6 lg:grid-cols-2">
              <div className="flex flex-col justify-between gap-6 rounded-3xl bg-gradient-to-br from-amber-100 to-amber-50 p-7 text-amber-950 ring-1 ring-amber-200 dark:from-amber-950 dark:to-zinc-950 dark:text-amber-100 dark:ring-amber-900">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-bold uppercase tracking-wide">First perk</p>
                  <p className="text-3xl font-bold tracking-tight">Lowel&apos;s empanadas</p>
                </div>
                <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                  <p className="text-5xl font-bold tracking-tight">₱25</p>
                  <p className="pb-1 text-lg font-semibold">each. Buy 5, get 1 free.</p>
                </div>
              </div>
              <div className={`${CARD} flex flex-col gap-6 p-6 sm:p-7`}>
                <div className="flex flex-col gap-3">
                  <h3 className="text-lg font-bold">Which perks do you want?</h3>
                  <PerkVote />
                </div>
                <div className={`border-t border-zinc-200 pt-5 text-base dark:border-zinc-800 ${MUTED}`}>
                  Own a shop near campus? <ContactDrawer label="Message us" className="inline-flex min-h-11 items-center font-semibold text-[var(--foreground)] underline" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Founding User */}
        {FOUNDING_USER_ENABLED ? (
          <section aria-labelledby="founding-heading" className={SECTION}>
            <div className={WRAP}>
              <div className="grid items-center gap-8 rounded-3xl bg-gradient-to-br from-amber-100 via-amber-50 to-white p-7 ring-1 ring-amber-200 sm:p-10 md:grid-cols-2 dark:from-amber-950 dark:via-zinc-950 dark:to-zinc-950 dark:ring-amber-900">
                <div className="flex flex-col gap-4">
                  <p className="text-sm font-bold uppercase tracking-wide text-amber-900 dark:text-amber-200">First 100 members</p>
                  <h2 id="founding-heading" className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                    Become a Founding User
                  </h2>
                  <p className="text-pretty text-lg text-zinc-700 dark:text-zinc-300">The first 100 members to join get a Founding User badge on their profile, for good.</p>
                  <Link href="/sign-up" className={`${SOLID} self-start`}>
                    Claim my place
                  </Link>
                </div>
                <div className="flex flex-col gap-4">
                  {/* A drawing of the badge on a profile row, not a real person. */}
                  <div role="img" aria-label="Example of a profile with the Founding User badge" className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-md ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800">
                    <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 text-lg font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      Y
                    </span>
                    <div aria-hidden className="flex min-w-0 flex-1 flex-col items-start gap-1">
                      <p className="font-bold leading-tight">You <span className="font-normal text-zinc-500">@your_handle</span></p>
                    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-amber-100 pl-2 pr-3 text-sm font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3z" />
                      </svg>
                      Founding User
                    </span>
                    </div>
                  </div>
                  <ol className="flex flex-col gap-3 text-base">
                    {["Create your account", "Finish sign-up with your handle", "The badge appears on your profile"].map((step, i) => (
                      <li key={step} className="flex items-center gap-3">
                        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-950 dark:bg-amber-900 dark:text-amber-100">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* Safety */}
        <section aria-labelledby="safety-heading" className={`${SECTION} ${FOUNDING_USER_ENABLED ? "bg-zinc-50 dark:bg-zinc-900" : ""}`}>
          <div className={`${WRAP} flex flex-col gap-10`}>
            <Heading id="safety-heading" eyebrow="Safety" title="Verified students, safer meet-ups" />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SAFETY.map((item) => (
                <li key={item.title} className={`${CARD} flex flex-col gap-3 p-6`}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand-text">
                    <SettingsIcon name={item.icon} />
                  </span>
                  <h3 className="text-lg font-bold">{item.title}</h3>
                  <p className={MUTED}>{item.text}</p>
                </li>
              ))}
              <li className="flex gap-4 rounded-2xl bg-amber-100 p-6 text-amber-950 sm:col-span-2 lg:col-span-3 dark:bg-amber-950 dark:text-amber-100">
                <svg viewBox="0 0 24 24" className="mt-0.5 h-6 w-6 shrink-0 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 3l10 18H2L12 3zM12 10v5M12 18v.01" />
                </svg>
                <p>
                  <strong>Studiskarte never handles money and gives no payment protection.</strong> Do not pay before you and the other member have agreed a time and a place for the handover.
                </p>
              </li>
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-heading" className={SECTION}>
          <div className={`${WRAP} grid gap-10 md:grid-cols-[1fr_1.6fr] md:gap-14`}>
            <div className="flex flex-col gap-6">
              <Heading id="faq-heading" eyebrow="Questions" title="Good to know" />
              <div className={`text-lg ${MUTED}`}>
                Something else on your mind? <ContactDrawer label="Message us" className="inline-flex min-h-11 items-center font-semibold text-[var(--foreground)] underline" />
              </div>
            </div>
            <div className={`${CARD} flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800`}>
              {FAQ.map((item) => (
                <details key={item.q} className="group px-5">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 text-base font-semibold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-none stroke-zinc-500 transition-transform duration-150 group-[[open]]:rotate-90 motion-reduce:transition-none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </summary>
                  <p className={`pb-5 ${MUTED}`}>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final call to action */}
        <section aria-labelledby="cta-heading" className="pb-16 sm:pb-20">
          <div className={WRAP}>
            <div className="flex flex-col items-center gap-5 rounded-3xl bg-brand px-6 py-14 text-center text-white sm:px-10">
              <h2 id="cta-heading" className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                Simulan na ang diskarte mo.
              </h2>
              {FOUNDING_USER_ENABLED ? (
                <p className="max-w-md text-pretty text-lg text-white/90">Be one of the first 100 members to join and get a Founding User badge on your profile.</p>
              ) : null}
              <Link href="/sign-up" className={PRIMARY}>
                Join Studiskarte
              </Link>
              <Link href="/sign-in" className="inline-flex min-h-11 items-center text-base underline">
                Already a member? Log in
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-zinc-950 text-zinc-300">
        <div className={`${WRAP} flex flex-col gap-10 py-14`}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="col-span-2 flex flex-col gap-4 md:col-span-1">
              <Link href="/" className="flex items-center gap-2.5 text-white" aria-label="Studiskarte">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-64.webp" alt="" width={36} height={36} loading="lazy" decoding="async" className="h-9 w-9 rounded-xl" />
                <span className="text-xl font-bold">Studiskarte</span>
              </Link>
              <p className="max-w-xs text-sm text-zinc-400">Where student hustle meets student needs. Follow us for updates, tips and new features.</p>
              <SocialLinks className="max-w-xs [&_a]:border-zinc-700 [&_a]:text-zinc-200" />
            </div>
            <nav aria-label="Studiskarte" className="flex flex-col gap-1 text-sm">
              <p className="mb-2 font-semibold text-white">Studiskarte</p>
              <Link href="/about" className="inline-flex min-h-11 items-center hover:text-white">About</Link>
              <Link href="/sign-up" className="inline-flex min-h-11 items-center hover:text-white">Join</Link>
              <Link href="/sign-in" className="inline-flex min-h-11 items-center hover:text-white">Log in</Link>
            </nav>
            {legal ? (
              <nav aria-label="Legal" className="flex flex-col gap-1 text-sm">
                <p className="mb-2 font-semibold text-white">Legal</p>
                {LEGAL_SLUGS.map((slug) => (
                  <Link key={slug} href={`/legal/${slug}`} className="inline-flex min-h-11 items-center hover:text-white">
                    {LEGAL_TITLES[slug]}
                  </Link>
                ))}
              </nav>
            ) : null}
            <div className="col-span-2 flex flex-col gap-1 text-sm md:col-span-1">
              <p className="mb-2 font-semibold text-white">Contact</p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex min-h-11 items-center hover:text-white">{SUPPORT_EMAIL}</a>
              <ContactDrawer label="Message us" className="inline-flex min-h-11 items-center text-left hover:text-white" />
              <CookieSettingsButton className="inline-flex min-h-11 items-center text-left hover:text-white" />
            </div>
          </div>
          <div className="flex flex-col gap-3 border-t border-zinc-800 pt-6 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p>Studiskarte Marketplace. Not affiliated with any school.</p>
              <p>Child safety and urgent reports are read within 24 hours.</p>
            </div>
            <a href="#top" className="press inline-flex min-h-11 items-center gap-2 self-start rounded-full border border-zinc-700 px-4 font-semibold text-zinc-200 sm:self-auto">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
              </svg>
              Back to top
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
