import { Suspense } from "react";
import Link from "next/link";
import { safeMfaReturnTo } from "@/lib/identity/admin-mfa";
import { TwoFactorForm } from "./two-factor-form";

export const metadata = { title: "Security check · Studiskarte", robots: { index: false, follow: false } };

export default function TwoFactorPage({ searchParams }: PageProps<"/two-factor">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-8 px-6 pb-24 pt-8">
      <Link href="/" aria-label="Studiskarte home" className="press -ml-1 self-start rounded-2xl p-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-12 w-12 rounded-2xl shadow-md" />
      </Link>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Security check</h1>
        <p className="text-base text-zinc-600 dark:text-zinc-400">Enter the current code from your authenticator app.</p>
      </div>
      <Suspense><Form searchParams={searchParams} /></Suspense>
    </main>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/two-factor">["searchParams"] }) {
  return <TwoFactorForm next={safeMfaReturnTo((await searchParams).next)} />;
}
