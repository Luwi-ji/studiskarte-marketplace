import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalText } from "@/components/legal-text";
import { currentLegal, isLegalSlug, LEGAL_SLUGS, LEGAL_TITLES } from "@/lib/legal/documents";

export function generateStaticParams() {
  return currentLegal() ? LEGAL_SLUGS.map((doc) => ({ doc })) : [];
}

export async function generateMetadata({ params }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  return { title: `${isLegalSlug(doc) ? LEGAL_TITLES[doc] : "Legal"} · Studiskarte Marketplace` };
}

/** The terms, privacy policy and community guidelines: readable by anyone, signed in or not. */
export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  const legal = currentLegal();
  if (!legal || !isLegalSlug(doc)) notFound();
  return (
    <main className="mx-auto w-full max-w-prose flex-1 px-4 py-6">
      <h1 className="mb-1 text-2xl font-semibold">{LEGAL_TITLES[doc]}</h1>
      <p className="mb-4 text-xs text-zinc-500">Version {legal.version}</p>
      <LegalText source={legal.text[doc]} />
      <nav className="mt-8 flex flex-wrap gap-x-4 gap-y-2 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
        {LEGAL_SLUGS.filter((slug) => slug !== doc).map((slug) => (
          <Link key={slug} href={`/legal/${slug}`} className="underline">
            {LEGAL_TITLES[slug]}
          </Link>
        ))}
      </nav>
    </main>
  );
}
