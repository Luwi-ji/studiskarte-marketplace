import { Suspense } from "react";
import { requireAdmin } from "@/lib/access";
import { TestButtons } from "./test-buttons";

export const metadata = { title: "Sentry test" };

// Temporary: proves error reports reach Sentry from the server and the browser. Remove after use.
export default function SentryTestPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Guarded />
      </Suspense>
    </main>
  );
}

async function Guarded() {
  await requireAdmin();
  return <TestButtons />;
}
