import Link from "next/link";
import { LegalLinks } from "@/components/legal-links";

export const metadata = {
  title: "About · Studiskarte Marketplace",
  description:
    "Studiskarte Marketplace is a mobile app where students in the Philippines sell things and offer services to each other, and say what they are looking for.",
};

/** The public home page of the app: what it is, what it does with Google sign-in data, and the legal links. No login needed. */
export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-prose flex-1 flex-col gap-6 px-6 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-24 w-24 rounded-3xl shadow-lg" />
        <h1 className="text-3xl font-semibold">Studiskarte Marketplace</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">Where student hustle meets student needs.</p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">What it is</h2>
        <p>
          Studiskarte Marketplace is an installable mobile web app for students in the Philippines. Students sell what
          they no longer need, offer services such as tutoring or design work, and post a wishlist of what they are
          looking for. Faculty, staff, alumni and other visitors can join too.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">What you can do</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Post a Showcase listing (what you offer) or a Wishlist item (what you want), with photos, price and when you are free to meet.</li>
          <li>Browse a feed, search, and filter by school, category, price and condition.</li>
          <li>Message another member, make an offer, reserve, and agree a time and place for the handover.</li>
          <li>Leave and read reviews after a completed deal, and report or block anyone who misbehaves.</li>
        </ul>
        <p>The app never handles money. You pay each other in person or in the way the listing says.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Signing in and your data</h2>
        <p>
          You create an account with your school email or another email address. We send a code to prove it is yours,
          then you choose a password. You can also choose <strong>Continue with Google</strong>.
        </p>
        <p>
          If you use Google, Google sends the app your basic profile (email address, name and picture). The app uses
          only the email address, to find or create your account, and throws the rest away. It does not read your
          contacts, calendar, files or anything else in your Google account. Your email is never shown to other members. The{" "}
          <Link href="/legal/privacy" className="underline">
            Privacy Policy
          </Link>{" "}
          lists everything we collect, who else handles it, how long it is kept, and how to delete your account.
        </p>
      </section>

      <div className="flex flex-col gap-3">
        <Link href="/sign-in" className="w-full rounded-lg bg-brand px-3 py-3 text-center text-base font-medium text-white">
          Log in
        </Link>
        <Link
          href="/sign-up"
          className="w-full rounded-lg border border-zinc-300 px-3 py-3 text-center text-base font-medium dark:border-zinc-700"
        >
          Create an account
        </Link>
      </div>

      <LegalLinks />
    </main>
  );
}
