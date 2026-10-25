import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import { HapticsProvider } from "@/components/haptics";
import { InstallListener } from "@/components/install";
import { ReminderHost } from "@/components/reminder-host";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { BlockedNotice } from "./safety/blocked-notice";
import { ServiceWorkerRegistration } from "./service-worker-registration";
import { UpdateNotice } from "./update-notice";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

// One variable font for the whole app, self-hosted at build time (no request to Google when a page loads).
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });

export const metadata: Metadata = {
  title: "Studiskarte Marketplace",
  description: "Where student hustle meets student needs.",
  // Proves to Google Search Console that this site is ours (meta tag method; the HTML file in /public is the other proof).
  verification: { google: "cE40YZSYPWJRhyONX7G3jMscWPQ-W-v6aj2xGEWXW7Y" },
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
    { media: "(prefers-color-scheme: dark)", color: "#0b101a" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${figtree.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorkerRegistration />
        <HapticsProvider />
        <PullToRefresh />
        <UpdateNotice />
        <ReminderHost />
        <InstallListener />
        <BlockedNotice />
      </body>
    </html>
  );
}
