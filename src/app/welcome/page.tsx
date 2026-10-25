import { Suspense } from "react";
import { redirect } from "next/navigation";
import { StepHeader } from "@/components/auth-steps";
import { getSignedInStudent } from "@/lib/access";
import { hasPassword } from "@/lib/identity/password";
import { getOwnProfile } from "@/lib/identity/profile";
import { parseSchoolRole } from "@/lib/identity/roles";
import { currentLegal } from "@/lib/legal/documents";
import { safeReturnTo } from "@/lib/identity/return-to";
import { PasswordForm } from "./password-form";
import { WelcomeForm } from "./welcome-form";

export const metadata = { title: "Welcome · Studiskarte Marketplace" };

export default function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  return (
    // Content sits in the upper half, so a password manager's pop-up at the bottom of the screen does not cover it.
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-8 px-6 pb-24 pt-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="Studiskarte" className="h-12 w-12 rounded-2xl shadow-md" />
      <Suspense>
        <Guarded searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// Only for signed-in people who have not finished sign-up: first a password, then the profile.
async function Guarded({ searchParams }: { searchParams: PageProps<"/welcome">["searchParams"] }) {
  const params = await searchParams;
  const next = safeReturnTo(params.next);
  const chosenRole = parseSchoolRole(params.role) ?? "student";
  const me = await getSignedInStudent();
  if (!me) redirect("/sign-in");
  if (me.handle) redirect(next ?? "/");
  if (!(await hasPassword(me.id))) {
    return (
      <div className="flex flex-col gap-6">
        <StepHeader step={3} title="Choose a password" subtitle="Your email is confirmed. This is what you log in with." />
        <PasswordForm next={next} />
      </div>
    );
  }
  const school = me.schoolDomain ? (await getOwnProfile(me.id))?.school : null;
  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        step={4}
        title="Make it yours"
        subtitle={school ? <>You are joining <strong className="text-[var(--foreground)]">{school}</strong>. Pick how others find you.</> : "Pick how other students find you. Your email is never shown."}
      />
      <WelcomeForm terms={currentLegal()?.version ?? null} askRole={me.role !== "visitor"} defaultRole={chosenRole} next={next} />
    </div>
  );
}
