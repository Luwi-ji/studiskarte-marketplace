"use client";

import { useCallback, useEffect, useState } from "react";
import { checkAlertsAction, removeAlertsAction, saveAlertsAction } from "@/app/notifications/actions";
import { currentSubscription, deviceSupport, keyToBytes, type DeviceSupport } from "@/lib/notifications/push/device";

type Status = "checking" | "off" | "on" | "blocked" | DeviceSupport | "not_set_up";

const MESSAGE: Partial<Record<Status, string>> = {
  unsupported: "This browser cannot show alerts. You still see everything in the app.",
  blocked: "Alerts are blocked for this site. Allow notifications in your browser or phone settings, then come back.",
  not_set_up: "Alerts are not set up yet. You still see everything in the app.",
};

/** Alerts on or off for this device: what it is now, and the two ways to change it. */
export function useDeviceAlerts(publicKey: string | null) {
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

  const turnOn = useCallback(async () => {
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
  }, [publicKey]);

  const turnOff = useCallback(async () => {
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
  }, []);

  return { status, busy, error, on: status === "on", canToggle: status === "on" || status === "off", turnOn, turnOff };
}

/** The switch. Its accessible name is the row's title. */
export function AlertsSwitch({ on, disabled, onToggle }: { on: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Alerts on this device"
      disabled={disabled}
      onClick={onToggle}
      className="relative flex h-11 w-14 shrink-0 items-center disabled:opacity-40"
    >
      <span className={`block h-8 w-14 rounded-full transition-colors duration-150 ease-out motion-reduce:transition-none ${on ? "bg-brand" : "bg-[var(--field-border)]"}`} />
      <span className={`absolute left-0 top-2.5 h-6 w-6 rounded-full bg-white transition-transform duration-150 ease-out motion-reduce:transition-none ${on ? "translate-x-7" : "translate-x-1"}`} />
    </button>
  );
}

/** The guidance under the switch: how to get alerts on an iPhone, or why they cannot be turned on here. */
export function AlertsGuidance({ status }: { status: Status }) {
  return (
    <>
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
      {MESSAGE[status] ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{MESSAGE[status]}</p> : null}
    </>
  );
}

/**
 * The prompt on the Notifications page while alerts are not on. Alerts are only ever a nudge: everything they say is
 * also in the Notifications list. Once they are on, or while we do not know yet, it takes no room.
 */
export function AlertsToggle({ publicKey }: { publicKey: string | null }) {
  const { status, busy, error, on, canToggle, turnOn, turnOff } = useDeviceAlerts(publicKey);
  if (status === "checking" || on) return null;
  return (
    <section className="mx-3 mt-3 flex flex-col gap-2 rounded-xl border border-brand bg-zinc-50 px-3 py-1 dark:bg-zinc-900">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-medium">Get a phone alert for handover times and payments.</p>
        <AlertsSwitch on={on} disabled={!canToggle || busy} onToggle={on ? turnOff : turnOn} />
      </div>
      <div className="pb-2">
        <AlertsGuidance status={status} />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/** The Alerts page on Settings: a titled switch row, what alerts are, and the device's caveats. */
export function AlertsSettings({ publicKey }: { publicKey: string | null }) {
  const { status, busy, error, on, canToggle, turnOn, turnOff } = useDeviceAlerts(publicKey);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-zinc-200 px-4 dark:border-zinc-800">
        <span className="text-base font-medium">Alerts on this device</span>
        <AlertsSwitch on={on} disabled={!canToggle || busy} onToggle={on ? turnOff : turnOn} />
      </div>
      <div className="flex flex-col gap-3 px-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          A short phone alert for messages, reservations, handover reminders and payments. It shows the post&apos;s title and, for a handover, its time and place, never what a message says. This only affects this device; everything is also in your Notifications.
        </p>
        <AlertsGuidance status={status} />
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** "On" or "Off" for the Settings row; nothing while it is being worked out. A device that cannot show alerts reads Off. */
export function AlertsRowValue({ publicKey }: { publicKey: string | null }) {
  const { status, on } = useDeviceAlerts(publicKey);
  return status === "checking" ? <span className="inline-block h-4 w-8 rounded bg-zinc-200 dark:bg-zinc-800" aria-hidden /> : on ? "On" : "Off";
}
