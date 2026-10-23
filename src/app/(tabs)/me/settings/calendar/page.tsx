import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { requireActiveStudent } from "@/lib/access";
import { hasCalendarToken } from "@/lib/calendar/token";
import { CalendarSettings } from "./calendar-settings";

export const metadata = { title: "Calendar · Studiskarte Marketplace" };

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="Calendar" back="/me/settings" />
      <main className="mx-auto w-full max-w-md flex-1 pb-6">
        <Suspense fallback={<div aria-hidden className="mx-4 mt-6 h-40 rounded-lg bg-zinc-100 motion-safe:animate-pulse dark:bg-zinc-900" />}>
          <Loaded />
        </Suspense>
      </main>
    </>
  );
}

async function Loaded() {
  const me = await requireActiveStudent();
  return <CalendarSettings active={await hasCalendarToken(me.id)} />;
}
