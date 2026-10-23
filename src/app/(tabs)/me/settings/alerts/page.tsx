import { PageHeader } from "@/components/page-header";
import { AlertsSettings } from "@/components/alerts-toggle";
import { alertsConfigured } from "@/lib/notifications/push/notify";

export const metadata = { title: "Alerts on this device · Studiskarte Marketplace" };

export default function AlertsPage() {
  return (
    <>
      <PageHeader title="Alerts on this device" back="/me/settings" />
      <main className="mx-auto w-full max-w-md flex-1 py-2">
        <AlertsSettings publicKey={alertsConfigured() ? (process.env.VAPID_PUBLIC_KEY ?? null) : null} />
      </main>
    </>
  );
}
