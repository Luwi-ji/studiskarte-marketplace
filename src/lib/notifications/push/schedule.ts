import { after } from "next/server";
import { deliverAlert } from "@/lib/notifications/push/notify";
import type { AlertSink } from "@/lib/notifications/record";

/** For server actions: sends the device alert once the response has gone, so it never slows or fails the action. */
export const sendAlertAfterResponse: AlertSink = (notificationId) => {
  after(() => deliverAlert(notificationId));
};
