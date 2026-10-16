// Browser-only helpers for this device's alert subscription.

/** What the browser can do about alerts right now. */
export type DeviceSupport = "ready" | "unsupported" | "install_needed";

/** An iPhone or iPad that has not installed the app: alerts exist only for the installed app there. */
function isIosBrowser(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function isInstalled(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && navigator.standalone === true);
}

export function deviceSupport(): DeviceSupport {
  const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (capable) return "ready";
  return isIosBrowser() && !isInstalled() ? "install_needed" : "unsupported";
}

/** This device's push subscription, if it has one. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (deviceSupport() !== "ready") return null;
  // getRegistration answers at once (with nothing when there is none); `ready` would wait for ever.
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

/** The server key arrives as URL-safe base64; the browser wants bytes. */
export function keyToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
