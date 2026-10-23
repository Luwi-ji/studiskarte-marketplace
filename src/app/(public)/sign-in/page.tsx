import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LegalLinks } from "@/components/legal-links";
import { getSignedInStudent } from "@/lib/access";
import { googleEnabled } from "@/lib/identity/auth";
import { safeReturnTo } from "@/lib/identity/return-to";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Log in · Studiskarte Marketplace" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-24 w-24 rounded-3xl shadow-lg" />
        <h1 className="text-2xl font-semibold">Studiskarte Marketplace</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Where student hustle meets student needs.</p>
      </header>
      <Suspense>
        <Form searchParams={searchParams} />
      </Suspense>
      <LegalLinks />
      <Suspense>
        <SkipIfSignedIn searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const { google, next } = await searchParams;
  return <SignInForm google={googleEnabled} googleFailed={google === "failed"} next={safeReturnTo(next)} />;
}

// A signed-in student has no reason to be here.
async function SkipIfSignedIn({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  if (await getSignedInStudent()) redirect(safeReturnTo((await searchParams).next) ?? "/");
  return null;
}
