import { Suspense } from "react";
import { BellLink } from "@/components/header-icon-links";
import { getSignedInStudent } from "@/lib/access";
import { countUnreadNotifications } from "@/lib/notifications/list";

async function BellWithCount() {
  const me = await getSignedInStudent();
  return <BellLink unread={me ? await countUnreadNotifications(me.id) : 0} />;
}

/** The bell in the feed header, with the number of unread notifications. */
export function NotificationBell() {
  return (
    <Suspense fallback={<BellLink unread={0} />}>
      <BellWithCount />
    </Suspense>
  );
}
