import Link from "next/link";
import { AdminNav } from "./admin-nav";

export const metadata = { title: "Admin · Studiskarte Marketplace" };

// Only the frame lives here. A layout is not rendered again when moving between its pages, so every
// page (and every server action) checks requireAdmin itself.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-[var(--background)]/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-zinc-800">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-1 px-2">
          <Link href="/me/settings" aria-label="Back to settings" className="flex h-11 w-11 items-center justify-center rounded-full text-2xl">
            ‹
          </Link>
          <p className="min-w-0 flex-1 truncate text-lg font-semibold">Admin</p>
        </div>
        <AdminNav />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4">{children}</main>
    </>
  );
}
