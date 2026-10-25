import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSignedInStudent } from "@/lib/access";
import { googleEnabled } from "@/lib/identity/auth";
import { safeReturnTo } from "@/lib/identity/return-to";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Log in · Studiskarte Marketplace" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    // Content sits in the upper half, so a password manager's pop-up at the bottom of the screen does not cover it.
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-8 px-6 pb-24 pt-8">
      {/* The logo goes back to the landing page. */}
      <Link href="/" aria-label="Studiskarte home" className="press -ml-1 self-start rounded-2xl p-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-12 w-12 rounded-2xl shadow-md" />
      </Link>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-base text-zinc-600 dark:text-zinc-400">Log in to buy, sell and find things from students.</p>
      </div>
      <Suspense>
        <Form searchParams={searchParams} />
      </Suspense>
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
  const params = await searchParams;
  if (await getSignedInStudent()) redirect(safeReturnTo(params.next) ?? "/");
  return null;
}
