import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { SupportForm } from "../support-form";

export const metadata = { title: "Report a bug · Studiskarte Marketplace" };

export default function BugPage() {
  return (
    <>
      <PageHeader title="Report a bug" back="/me/settings" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        <Suspense fallback={null}>
          <Form />
        </Suspense>
      </main>
    </>
  );
}

async function Form() {
  await requireActiveStudent();
  return <SupportForm kind="bug" />;
}
