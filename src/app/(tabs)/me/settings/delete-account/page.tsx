import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { DeleteAccount } from "../delete-account";

export const metadata = { title: "Delete my account · Studiskarte Marketplace" };

export default function DeleteAccountPage() {
  return (
    <>
      <PageHeader title="Delete my account" back="/me/settings" />
      <main className="mx-auto w-full max-w-md flex-1">
        <Suspense fallback={null}>
          <Form />
        </Suspense>
      </main>
    </>
  );
}

async function Form() {
  const me = await requireActiveStudent();
  // Admins cannot delete their account here.
  if (me.isAdmin || !me.handle) notFound();
  return <DeleteAccount handle={me.handle} />;
}
