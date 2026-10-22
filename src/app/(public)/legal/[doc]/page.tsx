import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalText } from "@/components/legal-text";
import { PageHeader } from "@/components/page-header";
import { getSignedInStudent } from "@/lib/access";
import { currentLegal, isLegalSlug, LEGAL_SLUGS, LEGAL_TITLES, type LegalSlug } from "@/lib/legal/documents";

// Always every document (Cache Components needs at least one); without the owner's text each one answers 404.
export function generateStaticParams() {
  return LEGAL_SLUGS.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  return { title: `${isLegalSlug(doc) ? LEGAL_TITLES[doc] : "Legal"} · Studiskarte Marketplace` };
}

/** The terms, privacy policy, community guidelines and child safety standards: readable by anyone, signed in or not. */
export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  const legal = currentLegal();
  if (!legal || !isLegalSlug(doc)) notFound();
  return (
    <>
      {/* Signed-in members go back to Settings, visitors to About; About is the fallback while we find out. */}
      <Suspense fallback={<PageHeader title={LEGAL_TITLES[doc]} back="/about" />}>
        <Header doc={doc} />
      </Suspense>
      <main className="mx-auto w-full max-w-prose flex-1 px-4 py-6">
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Version <span className="whitespace-nowrap">{legal.version}</span>
        </p>
        <LegalText source={legal.text[doc]} />
        <nav aria-label="Other legal documents" className="mt-10 flex flex-wrap gap-x-5 gap-y-1 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          {LEGAL_SLUGS.filter((slug) => slug !== doc).map((slug) => (
            <Link key={slug} href={`/legal/${slug}`} className="inline-flex min-h-11 items-center text-base underline">
              {LEGAL_TITLES[slug]}
            </Link>
          ))}
        </nav>
      </main>
    </>
  );
}

async function Header({ doc }: { doc: LegalSlug }) {
  const member = await getSignedInStudent();
  return <PageHeader title={LEGAL_TITLES[doc]} back={member ? "/me/settings" : "/about"} />;
}
