import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { CHILD_SAFETY_REASON, REPORT_REASONS } from "@/lib/safety/report";
import { ReportForm } from "../report-form";

export const metadata = { title: "Report a listing · Studiskarte Marketplace" };

export default function ReportListingPage() {
  return (
    <>
      <PageHeader title="Report a listing" back="/me/settings" />
      <main className="mx-auto w-full max-w-md flex-1">
        <Suspense fallback={null}>
          <Form />
        </Suspense>
      </main>
    </>
  );
}

async function Form() {
  await requireActiveStudent();
  return <ReportForm kind="listing" reasons={REPORT_REASONS} childSafetyId={CHILD_SAFETY_REASON} />;
}
