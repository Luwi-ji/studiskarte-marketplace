import { Suspense } from "react";
import { requireAdminAccount } from "@/lib/access";
import { hasRecentAdminMfa } from "@/lib/identity/admin-mfa";
import { MfaPanel } from "./mfa-panel";

export const metadata = { title: "Security · Admin · Studiskarte Marketplace" };

export default function AdminSecurityPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Security</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Protect owner access with an authenticator app and offline recovery codes.</p>
      </div>
      <Suspense fallback={<p className="p-4 text-zinc-500">Loading…</p>}><Content /></Suspense>
    </div>
  );
}

async function Content() {
  const admin = await requireAdminAccount();
  const recent = admin.twoFactorEnabled ? await hasRecentAdminMfa(admin.id) : false;
  return <MfaPanel enabled={admin.twoFactorEnabled} recent={recent} />;
}
