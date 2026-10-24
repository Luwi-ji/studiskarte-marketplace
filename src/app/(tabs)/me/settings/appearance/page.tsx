import { PageHeader } from "@/components/page-header";
import { AppearanceSettings } from "@/components/appearance-settings";

export const metadata = { title: "Appearance · Studiskarte Marketplace" };

export default function AppearancePage() {
  return (
    <>
      <PageHeader title="Appearance" back="/me/settings" />
      <main className="mx-auto w-full max-w-md flex-1 py-2">
        <AppearanceSettings />
      </main>
    </>
  );
}
