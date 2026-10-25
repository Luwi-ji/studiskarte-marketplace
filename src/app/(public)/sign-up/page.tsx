import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getSignedInStudent } from "@/lib/access";
import { visitorsAllowed } from "@/lib/identity/auth";
import { safeReturnTo } from "@/lib/identity/return-to";
import { SignUpForm } from "./sign-up-form";

export const metadata = { title: "Create account · Studiskarte Marketplace" };

export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    // Content sits in the upper half, so a password manager's pop-up at the bottom of the screen does not cover it.
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-8 px-6 pb-24 pt-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Studiskarte" className="h-12 w-12 rounded-2xl shadow-md" />
      <Suspense>
        <Form searchParams={searchParams} />
      </Suspense>
      <Suspense>
        <SkipIfSignedIn searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// Read per request: ALLOW_VISITORS is set in the deployment, not at build time.
async function Form({ searchParams }: { searchParams: PageProps<"/sign-up">["searchParams"] }) {
  await connection();
  return <SignUpForm visitors={visitorsAllowed()} next={safeReturnTo((await searchParams).next)} />;
}

// A signed-in student has no reason to be here.
async function SkipIfSignedIn({ searchParams }: { searchParams: PageProps<"/sign-up">["searchParams"] }) {
  if (await getSignedInStudent()) redirect(safeReturnTo((await searchParams).next) ?? "/");
  return null;
}
