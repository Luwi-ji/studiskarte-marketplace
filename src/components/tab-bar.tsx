import { Suspense, type ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { getSignedInStudent } from "@/lib/access";
import { countUnread } from "@/lib/messaging/read";
import { hasVisiblePerks } from "@/lib/perks/list";

/** The tab bar with the unread-message count, the member's own handle and whether their school has perks. Signed out, it shows no count. */
/** The bar reads the current path in the browser; on a route with a dynamic segment that has to wait inside Suspense, so even the placeholder and the signed-out bar sit in one. */
function PlainBar() {
  return (
    <Suspense fallback={<div className="h-16" aria-hidden />}>
      <BottomNav />
    </Suspense>
  );
}

async function NavWithBadge() {
  const me = await getSignedInStudent();
  if (!me) return <PlainBar />;
  const [unread, hasPerks] = await Promise.all([countUnread(me.id), hasVisiblePerks(me.schoolDomain)]);
  return <BottomNav unread={unread} hasPerks={hasPerks} handle={me.handle} canSell={me.role === "student"} />;
}

/** Page content that stops above the tab bar and the home bar, with the tab bar below it. */
export function WithTabBar({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">{children}</div>
      <Suspense fallback={<PlainBar />}>
        <NavWithBadge />
      </Suspense>
    </>
  );
}
