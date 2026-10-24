import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSignedInStudent } from "@/lib/access";
import { currentLegal } from "@/lib/legal/documents";
import { safeReturnTo, withReturnTo } from "@/lib/identity/return-to";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Updated terms · Studiskarte Marketplace" };

export default function AcceptTermsPage({ searchParams }: PageProps<"/accept-terms">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Our terms were updated</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Read them, then accept to keep using Studiskarte Marketplace.</p>
      </header>
      <Suspense>
        <Guarded searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// Only for a signed-in student who still has to accept the current version.
async function Guarded({ searchParams }: { searchParams: PageProps<"/accept-terms">["searchParams"] }) {
  const next = safeReturnTo((await searchParams).next);
  const me = await getSignedInStudent();
  if (!me) redirect("/sign-in");
  if (!me.handle) redirect(withReturnTo("/welcome", next));
  const legal = currentLegal();
  if (!legal || !me.mustAcceptTerms) redirect(next ?? "/");
  return <AcceptForm version={legal.version} next={next} />;
}
