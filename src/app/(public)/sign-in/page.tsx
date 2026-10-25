import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSignedInStudent } from "@/lib/access";
import { googleEnabled } from "@/lib/identity/auth";
import { parseRole, ROLE_LABEL, type Role } from "@/lib/identity/roles";
import { safeReturnTo } from "@/lib/identity/return-to";
import { buttonClass } from "../auth-styles";
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
      <Suspense>
        <SkipIfSignedIn searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const { google, next, chose } = await searchParams;
  const chosen = parseRole(chose);
  if (chosen) {
    const me = await getSignedInStudent();
    if (me) return <RoleNotice chosen={chosen} saved={me.role} href={safeReturnTo(next) ?? "/"} />;
  }
  return <SignInForm google={googleEnabled} googleFailed={google === "failed"} next={safeReturnTo(next)} />;
}

/** The role picked here differs from the account's saved role: sign-in worked, and this says which role applies. */
function RoleNotice({ chosen, saved, href }: { chosen: Role; saved: Role; href: string }) {
  return (
    <div role="status" className="flex flex-col gap-4">
      <p className="rounded-lg border border-zinc-300 px-3 py-3 text-sm dark:border-zinc-700">
        You are signed in as <strong>{ROLE_LABEL[saved]}</strong>. That role was set when your account was made, so choosing{" "}
        {ROLE_LABEL[chosen]} here does not change it.
      </p>
      <Link href={href} className={buttonClass}>
        Continue
      </Link>
    </div>
  );
}

// A signed-in student has no reason to be here, unless they are reading the role notice.
async function SkipIfSignedIn({ searchParams }: { searchParams: PageProps<"/sign-in">["searchParams"] }) {
  const params = await searchParams;
  if (parseRole(params.chose)) return null;
  if (await getSignedInStudent()) redirect(safeReturnTo(params.next) ?? "/");
  return null;
}
