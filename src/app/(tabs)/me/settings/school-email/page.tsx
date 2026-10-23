import { Suspense } from "react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { SchoolEmailForm } from "../school-email-form";

export const metadata = { title: "Become a student · Studiskarte Marketplace" };

export default function SchoolEmailPage() {
  return (
    <>
      <PageHeader title="Become a student" back="/me/settings" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        <Suspense fallback={null}>
          <Form />
        </Suspense>
      </main>
    </>
  );
}

async function Form() {
  const me = await requireActiveStudent();
  // Once the school email is attached there is nothing left to do here.
  if (me.role !== "visitor") redirect("/me/settings");
  return <SchoolEmailForm />;
}
