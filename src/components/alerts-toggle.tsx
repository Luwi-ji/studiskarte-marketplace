"use client";

import { useEffect, useState } from "react";
import { checkAlertsAction, removeAlertsAction, saveAlertsAction } from "@/app/notifications/actions";
import { currentSubscription, deviceSupport, keyToBytes, type DeviceSupport } from "@/lib/notifications/push/device";

type Status = "checking" | "off" | "on" | "blocked" | DeviceSupport | "not_set_up";

const MESSAGE: Partial<Record<Status, string>> = {
  unsupported: "This browser cannot show alerts. You still see everything in the app.",
  blocked: "Alerts are blocked for this site. Allow notifications in your browser or phone settings, then come back.",
  not_set_up: "Alerts are not set up yet. You still see everything in the app.",
};

/**
 * Alerts on or off for this device. Alerts are only ever a nudge: everything
 * they say is also in the Notifications list. On an iPhone they need the app
 * installed on the Home Screen, so there it explains how.
 */
export function AlertsToggle({ publicKey }: { publicKey: string | null }) {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const support = deviceSupport();
      let next: Status = support;
      if (support === "ready") {
        if (!publicKey) next = "not_set_up";
        else if (Notification.permission === "denied") next = "blocked";
        else {
          const sub = await currentSubscription();
          // On only if this device has a subscription the server also knows for this student.
          next = sub && (await checkAlertsAction(sub.endpoint)) ? "on" : "off";
        }
      }
      if (!cancelled) setStatus(next);
    })().catch(() => {
      if (!cancelled) setStatus("unsupported");
    });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  async function turnOn() {
    if (!publicKey) return;
    setBusy(true);
    setError(null);
    try {
      // Asking must happen in this tap, or the browser refuses.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const sub =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }));
      const saved = await saveAlertsAction(sub.toJSON());
      if (saved === "ok") setStatus("on");
      else setError(saved === "limit" ? "You have alerts on for too many devices. Turn one off first." : "Could not turn on alerts. Try again.");
    } catch {
      setError("Could not turn on alerts. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await removeAlertsAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch {
      setError("Could not turn off alerts. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const on = status === "on";
  const canToggle = status === "on" || status === "off";

  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Alerts on this device</p>
          <p className="text-xs text-zinc-500">A short alert for new messages and your posts. It shows only the post&apos;s title, never what a message says.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Alerts on this device"
          disabled={!canToggle || busy}
          onClick={on ? turnOff : turnOn}
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-40 ${on ? "bg-brand" : "bg-zinc-300 dark:bg-zinc-700"}`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${on ? "left-7" : "left-1"}`} />
        </button>
      </div>
      {status === "install_needed" ? (
        <div className="rounded-lg bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-900">
          <p className="font-medium">To get alerts on an iPhone, add Studiskarte to your Home Screen.</p>
          <ol className="ml-5 mt-1 list-decimal text-zinc-600 dark:text-zinc-400">
            <li>Tap the Share button in Safari.</li>
            <li>Tap Add to Home Screen.</li>
            <li>Open Studiskarte from your Home Screen and come back here.</li>
          </ol>
          <p className="mt-1 text-xs text-zinc-500">Until then, everything still shows in the app.</p>
        </div>
      ) : null}
      {MESSAGE[status] ? <p className="text-xs text-zinc-500">{MESSAGE[status]}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </section>
  );
}
