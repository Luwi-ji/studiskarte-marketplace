import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { LegalLinks } from "@/components/legal-links";
import { getSignedInStudent } from "@/lib/access";
import { visitorsAllowed } from "@/lib/identity/auth";
import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Create account · Studiskarte Marketplace" };

export default function SignUpPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-20 w-20 rounded-3xl shadow-lg" />
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          We send a code to your email to prove it is yours. Then you choose a password.
        </p>
      </header>
      <Suspense>
        <Form />
      </Suspense>
      <LegalLinks />
      <Suspense>
        <SkipIfSignedIn />
      </Suspense>
    </main>
  );
}

// Read per request: ALLOW_VISITORS is set in the deployment, not at build time.
async function Form() {
  await connection();
  return <SignUpForm visitors={visitorsAllowed()} />;
}

// A signed-in student has no reason to be here.
async function SkipIfSignedIn() {
  if (await getSignedInStudent()) redirect("/");
  return null;
}
