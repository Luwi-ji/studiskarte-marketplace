import { Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { getSignedInStudent } from "@/lib/access";
import { countUnread } from "@/lib/messaging/read";

/** The tab bar with the unread-message count. Without a signed-in student it shows no count. */
async function NavWithBadge() {
  const me = await getSignedInStudent();
  return <BottomNav unread={me ? await countUnread(me.id) : 0} />;
}

/** Pages reached from the bottom tabs. Content stops above the tab bar and the home bar. */
export default function TabsLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))]">{children}</div>
      <Suspense fallback={<BottomNav />}>
        <NavWithBadge />
      </Suspense>
    </>
  );
}
