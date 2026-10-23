import { Suspense } from "react";
import { requireAdmin } from "@/lib/access";
import { listSchools, SHORT_NAME_MAX } from "@/lib/admin/schools";
import { SchoolForm } from "./school-form";

export const metadata = { title: "Schools · Admin · Studiskarte Marketplace" };

export default function SchoolsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Schools</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Listing cards show a short name for the school, such as TUP-M. Set it here. Until you do, the card shows the capital letters of the full name (shown in grey). Leave it empty and press Clear to go back to that.
      </p>
      <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}>
        <SchoolList />
      </Suspense>
    </div>
  );
}

async function SchoolList() {
  await requireAdmin();
  const schools = await listSchools();
  if (schools.length === 0) return <p className="text-sm text-zinc-500">No schools yet. A school appears when its first student signs in.</p>;

  return (
    <ul className="flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {schools.map((s) => (
        <li key={s.domain} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm font-medium">{s.name}</p>
            <p className="truncate text-xs text-zinc-500">{s.domain}</p>
            <p className="text-sm">
              Cards show: <span className={s.shortName ? "font-semibold" : "text-zinc-500"}>{s.shown}</span>
            </p>
          </div>
          <SchoolForm domain={s.domain} initial={s.shortName ?? ""} placeholder={s.shown === s.name ? "e.g. TUP-M" : s.shown} max={SHORT_NAME_MAX} />
        </li>
      ))}
    </ul>
  );
}
