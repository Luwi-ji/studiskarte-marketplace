import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSignedInStudent } from "@/lib/access";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Forgot password · Studiskarte Marketplace" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Forgot your password?</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          We email a code to your account. Use it to choose a new password. If you came through Google or an
          older sign-in, this is also how you set your first password.
        </p>
      </header>
      <ResetForm />
      <Suspense>
        <SkipIfSignedIn />
      </Suspense>
    </main>
  );
}

async function SkipIfSignedIn() {
  if (await getSignedInStudent()) redirect("/");
  return null;
}
