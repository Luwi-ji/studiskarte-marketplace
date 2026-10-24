import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SettingsSkeleton } from "@/components/list-skeletons";
import { requireActiveStudent } from "@/lib/access";
import { FaqList } from "./faq-list";

export const metadata = { title: "FAQs · Studiskarte Marketplace" };

export default function FaqPage() {
  return (
    <>
      <PageHeader title="FAQs" back="/me/settings" />
      <main className="mx-auto w-full max-w-md flex-1 pb-6">
        <Suspense fallback={<SettingsSkeleton />}>
          <Faq />
        </Suspense>
      </main>
    </>
  );
}

async function Faq() {
  await requireActiveStudent();
  return <FaqList />;
}
