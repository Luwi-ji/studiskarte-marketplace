import Link from "next/link";
import { currentLegal, LEGAL_SLUGS, LEGAL_TITLES } from "@/lib/legal/documents";

/** Links to the legal documents; nothing until the owner has supplied them. */
export function LegalLinks({ className = "" }: { className?: string }) {
  if (!currentLegal()) return null;
  return (
    <nav aria-label="Legal" className={`flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400 ${className}`}>
      {LEGAL_SLUGS.map((slug) => (
        <Link key={slug} href={`/legal/${slug}`} className="inline-flex min-h-11 items-center underline">
          {LEGAL_TITLES[slug]}
        </Link>
      ))}
    </nav>
  );
}
