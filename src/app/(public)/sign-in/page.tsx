import { Suspense } from "react";
import { redirect } from "next/navigation";
import { LegalLinks } from "@/components/legal-links";
import { getSignedInStudent } from "@/lib/access";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in · Studiskarte Marketplace" };

export default function SignInPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-24 w-24 rounded-3xl shadow-lg" />
        <h1 className="text-2xl font-semibold">Studiskarte Marketplace</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Where student hustle meets student needs. Sign in with your school email; we send a code.
        </p>
      </header>
      <SignInForm />
      <LegalLinks />
      <Suspense>
        <SkipIfSignedIn />
      </Suspense>
    </main>
  );
}

// A signed-in student has no reason to be here.
async function SkipIfSignedIn() {
  if (await getSignedInStudent()) redirect("/");
  return null;
}
