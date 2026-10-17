import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegistration } from "./service-worker-registration";
import { UpdateNotice } from "./update-notice";

export const metadata: Metadata = {
  title: "Studiskarte Marketplace",
  description: "Where student hustle meets student needs.",
  // iOS reads these instead of the manifest when the app is added to the Home Screen.
  appleWebApp: { capable: true, title: "Studiskarte", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Draw under the notch and home bar; pages pad with env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorkerRegistration />
        <UpdateNotice />
      </body>
    </html>
  );
}
