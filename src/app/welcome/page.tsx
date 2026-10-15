import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSignedInStudent } from "@/lib/access";
import { WelcomeForm } from "./welcome-form";

export const metadata = { title: "Welcome · Studiskarte Marketplace" };

export default function WelcomePage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Welcome to Studiskarte</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Choose how other students will find you. Your school email is never shown.
        </p>
      </header>
      <Suspense>
        <Guarded />
      </Suspense>
    </main>
  );
}

// Only for signed-in students who have not chosen a handle yet.
async function Guarded() {
  const me = await getSignedInStudent();
  if (!me) redirect("/sign-in");
  if (me.handle) redirect("/");
  return <WelcomeForm />;
}
