import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSignedInStudent } from "@/lib/access";
import { hasPassword } from "@/lib/identity/password";
import { getOwnProfile } from "@/lib/identity/profile";
import { currentLegal } from "@/lib/legal/documents";
import { safeReturnTo } from "@/lib/identity/return-to";
import { PasswordForm } from "./password-form";
import { WelcomeForm } from "./welcome-form";

export const metadata = { title: "Welcome · Studiskarte Marketplace" };

export default function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <Suspense>
        <Guarded searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// Only for signed-in people who have not finished sign-up: first a password, then the profile.
async function Guarded({ searchParams }: { searchParams: PageProps<"/welcome">["searchParams"] }) {
  const next = safeReturnTo((await searchParams).next);
  const me = await getSignedInStudent();
  if (!me) redirect("/sign-in");
  if (me.handle) redirect(next ?? "/");
  if (!(await hasPassword(me.id))) {
    return (
      <>
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">Choose a password</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Your email is confirmed. Now choose the password you will log in with.</p>
        </header>
        <PasswordForm next={next} />
      </>
    );
  }
  const school = me.schoolDomain ? (await getOwnProfile(me.id))?.school : null;
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Welcome to Studiskarte</h1>
        {school ? <p className="font-medium">Your school: {school}</p> : null}
        <p className="text-zinc-600 dark:text-zinc-400">
          Choose how other people will find you. Your email is never shown.
        </p>
      </header>
      <WelcomeForm terms={currentLegal()?.version ?? null} askRole={me.role !== "visitor"} next={next} />
    </>
  );
}
